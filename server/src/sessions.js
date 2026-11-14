import { Hono } from 'hono';
import { z } from 'zod';
import { db } from './db.js';
import { logAudit } from './audit.js';
import { parseId, zodError } from './lib/validate.js';

const sessions = new Hono();

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'tanggal harus YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'tanggal tidak valid');

const setSchema = z.object({
  setNumber: z.number().int().positive().optional(),
  berat: z.number().nonnegative().nullable().optional(),
  reps: z.number().int().nonnegative().nullable().optional()
});

const exerciseSchema = z.object({
  namaExercise: z.string().trim().min(1, 'nama exercise wajib diisi').max(200),
  urutan: z.number().int().min(0).optional(),
  sets: z.array(setSchema).max(100).default([])
});

const sessionSchema = z.object({
  tanggal: dateString,
  planDayId: z.number().int().positive().nullable().optional(),
  catatan: z.string().max(2000).optional(),
  muscleGroupIds: z.array(z.number().int().positive()).max(50).default([]),
  exercises: z.array(exerciseSchema).max(200).default([])
});

const sessionPatchSchema = z.object({
  tanggal: dateString.optional(),
  planDayId: z.number().int().positive().nullable().optional(),
  catatan: z.string().max(2000).optional(),
  muscleGroupIds: z.array(z.number().int().positive()).max(50).optional(),
  exercises: z.array(exerciseSchema).max(200).optional()
});

function sessionJson(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    tanggal: row.tanggal,
    planDayId: row.plan_day_id,
    catatan: row.catatan ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function exerciseJson(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    namaExercise: row.nama_exercise,
    urutan: row.urutan
  };
}

function setJson(row) {
  return {
    id: row.id,
    sessionExerciseId: row.session_exercise_id,
    setNumber: row.set_number,
    berat: row.berat,
    reps: row.reps
  };
}

function findClient(id) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND arsip = 0').get(id);
}

function findSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND arsip = 0').get(id);
}

function validPlanDay(planDayId, clientId) {
  return db
    .prepare(
      `SELECT pd.id FROM plan_days pd
       JOIN plans p ON p.id = pd.plan_id
       WHERE pd.id = ? AND p.client_id = ?`
    )
    .get(planDayId, clientId);
}

function validMuscleIds(ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];

  const rows = db
    .prepare(
      `SELECT id FROM muscle_groups WHERE id IN (${unique.map(() => '?').join(', ')})`
    )
    .all(...unique);

  return rows.length === unique.length ? unique : null;
}

function sessionDetail(id) {
  const row = findSession(id);
  if (!row) return null;

  const muscles = db
    .prepare(
      `SELECT mg.id, mg.nama FROM session_muscles sm
       JOIN muscle_groups mg ON mg.id = sm.muscle_group_id
       WHERE sm.session_id = ? ORDER BY mg.nama`
    )
    .all(id);

  const setsStmt = db.prepare(
    'SELECT * FROM set_logs WHERE session_exercise_id = ? ORDER BY set_number, id'
  );

  const exercises = db
    .prepare('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY urutan, id')
    .all(id)
    .map((exercise) => ({
      ...exerciseJson(exercise),
      sets: setsStmt.all(exercise.id).map(setJson)
    }));

  return { ...sessionJson(row), muscles, exercises };
}

function insertExercises(sessionId, exercises, trainerId) {
  const exerciseStmt = db.prepare(
    'INSERT INTO session_exercises (session_id, nama_exercise, urutan) VALUES (?, ?, ?)'
  );
  const setStmt = db.prepare(
    'INSERT INTO set_logs (session_exercise_id, set_number, berat, reps) VALUES (?, ?, ?, ?)'
  );

  exercises.forEach((exercise, exerciseIndex) => {
    const info = exerciseStmt.run(sessionId, exercise.namaExercise, exercise.urutan ?? exerciseIndex);
    const created = db
      .prepare('SELECT * FROM session_exercises WHERE id = ?')
      .get(info.lastInsertRowid);

    logAudit(db, {
      trainerId,
      entityType: 'session_exercises',
      entityId: created.id,
      action: 'create',
      oldValue: null,
      newValue: exerciseJson(created)
    });

    (exercise.sets ?? []).forEach((set, setIndex) => {
      const setInfo = setStmt.run(
        created.id,
        setIndex + 1,
        set.berat ?? null,
        set.reps ?? null
      );
      const createdSet = db.prepare('SELECT * FROM set_logs WHERE id = ?').get(setInfo.lastInsertRowid);

      logAudit(db, {
        trainerId,
        entityType: 'set_logs',
        entityId: createdSet.id,
        action: 'create',
        oldValue: null,
        newValue: setJson(createdSet)
      });
    });
  });
}

function replaceExercises(sessionId, exercises, trainerId) {
  const oldExercises = db
    .prepare('SELECT * FROM session_exercises WHERE session_id = ? ORDER BY urutan, id')
    .all(sessionId);
  const oldSetsStmt = db.prepare('SELECT * FROM set_logs WHERE session_exercise_id = ?');

  for (const exercise of oldExercises) {
    for (const set of oldSetsStmt.all(exercise.id)) {
      db.prepare('DELETE FROM set_logs WHERE id = ?').run(set.id);
      logAudit(db, {
        trainerId,
        entityType: 'set_logs',
        entityId: set.id,
        action: 'delete',
        oldValue: setJson(set),
        newValue: null
      });
    }
    db.prepare('DELETE FROM session_exercises WHERE id = ?').run(exercise.id);
    logAudit(db, {
      trainerId,
      entityType: 'session_exercises',
      entityId: exercise.id,
      action: 'delete',
      oldValue: exerciseJson(exercise),
      newValue: null
    });
  }

  insertExercises(sessionId, exercises, trainerId);
}

function replaceMuscles(sessionId, muscleGroupIds) {
  db.prepare('DELETE FROM session_muscles WHERE session_id = ?').run(sessionId);
  const insert = db.prepare(
    'INSERT INTO session_muscles (session_id, muscle_group_id) VALUES (?, ?)'
  );
  for (const muscleGroupId of muscleGroupIds) {
    insert.run(sessionId, muscleGroupId);
  }
}

sessions.get('/muscle-groups', (c) => {
  return c.json(db.prepare('SELECT id, nama FROM muscle_groups ORDER BY id').all());
});

sessions.get('/clients/:id/sessions', (c) => {
  const clientId = parseId(c.req.param('id'));
  if (!clientId || !findClient(clientId)) {
    return c.json({ error: 'not found' }, 404);
  }

  const ids = db
    .prepare(
      `SELECT id FROM sessions WHERE client_id = ? AND arsip = 0
       ORDER BY tanggal DESC, id DESC`
    )
    .all(clientId);

  return c.json(ids.map(({ id }) => sessionDetail(id)));
});

sessions.post('/clients/:id/sessions', async (c) => {
  const clientId = parseId(c.req.param('id'));
  if (!clientId || !findClient(clientId)) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  const planDayId = data.planDayId ?? null;
  if (planDayId !== null && !validPlanDay(planDayId, clientId)) {
    return c.json({ error: 'planDayId tidak valid' }, 400);
  }

  const muscleGroupIds = validMuscleIds(data.muscleGroupIds);
  if (muscleGroupIds === null) {
    return c.json({ error: 'muscleGroupIds tidak valid' }, 400);
  }

  const trainerId = c.get('trainer').id;
  const detail = db.transaction(() => {
    const info = db
      .prepare(
        'INSERT INTO sessions (client_id, tanggal, plan_day_id, catatan) VALUES (?, ?, ?, ?)'
      )
      .run(clientId, data.tanggal, planDayId, data.catatan ?? '');
    const sessionId = info.lastInsertRowid;

    replaceMuscles(sessionId, muscleGroupIds);
    insertExercises(sessionId, data.exercises, trainerId);

    const created = sessionDetail(sessionId);
    logAudit(db, {
      trainerId,
      entityType: 'sessions',
      entityId: sessionId,
      action: 'create',
      oldValue: null,
      newValue: created
    });
    return created;
  })();

  return c.json(detail, 201);
});

sessions.get('/sessions/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const detail = id ? sessionDetail(id) : null;
  if (!detail) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(detail);
});

sessions.patch('/sessions/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? sessionDetail(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = sessionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  let planDayId = existing.planDayId;
  if (data.planDayId !== undefined) {
    planDayId = data.planDayId;
    if (planDayId !== null && !validPlanDay(planDayId, existing.clientId)) {
      return c.json({ error: 'planDayId tidak valid' }, 400);
    }
  }

  let muscleGroupIds = null;
  if (data.muscleGroupIds !== undefined) {
    muscleGroupIds = validMuscleIds(data.muscleGroupIds);
    if (muscleGroupIds === null) {
      return c.json({ error: 'muscleGroupIds tidak valid' }, 400);
    }
  }

  const tanggal = data.tanggal ?? existing.tanggal;
  const catatan = data.catatan ?? existing.catatan;
  const trainerId = c.get('trainer').id;

  const detail = db.transaction(() => {
    if (data.exercises !== undefined) {
      replaceExercises(id, data.exercises, trainerId);
    }

    db.prepare(
      'UPDATE sessions SET tanggal = ?, plan_day_id = ?, catatan = ? WHERE id = ?'
    ).run(tanggal, planDayId, catatan, id);

    if (muscleGroupIds !== null) {
      replaceMuscles(id, muscleGroupIds);
    }

    const updated = sessionDetail(id);
    logAudit(db, {
      trainerId,
      entityType: 'sessions',
      entityId: id,
      action: 'update',
      oldValue: existing,
      newValue: updated
    });
    return updated;
  })();

  return c.json(detail);
});

sessions.delete('/sessions/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? sessionDetail(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const trainerId = c.get('trainer').id;
  db.transaction(() => {
    db.prepare('UPDATE sessions SET arsip = 1 WHERE id = ?').run(id);
    logAudit(db, {
      trainerId,
      entityType: 'sessions',
      entityId: id,
      action: 'delete',
      oldValue: existing,
      newValue: { ...existing, arsip: true }
    });
  })();

  return c.json({ ok: true });
});

export default sessions;
