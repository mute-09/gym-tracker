import { Hono } from 'hono';
import { z } from 'zod';
import { db } from './db.js';
import { logAudit } from './audit.js';
import { parseId, zodError } from './lib/validate.js';

const plans = new Hono();

const planSchema = z.object({
  nama: z.string().trim().min(1, 'nama plan wajib diisi').max(200)
});

const planPatchSchema = planSchema.partial();

const daySchema = z.object({
  weekNumber: z.number().int().nullable().optional(),
  label: z.string().trim().min(1, 'label wajib diisi').max(100),
  urutan: z.number().int().min(0).optional()
});

const dayPatchSchema = z.object({
  weekNumber: z.number().int().nullable().optional(),
  label: z.string().trim().min(1, 'label wajib diisi').max(100).optional(),
  urutan: z.number().int().min(0).optional()
});

const exerciseSchema = z.object({
  namaExercise: z.string().trim().min(1, 'nama exercise wajib diisi').max(200),
  setTarget: z.number().int().positive().nullable().optional(),
  repTarget: z.string().max(100).nullable().optional(),
  urutan: z.number().int().min(0).optional()
});

const exercisePatchSchema = exerciseSchema.partial();

function planJson(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    nama: row.nama,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function dayJson(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    weekNumber: row.week_number,
    label: row.label,
    urutan: row.urutan
  };
}

function exerciseJson(row) {
  return {
    id: row.id,
    planDayId: row.plan_day_id,
    namaExercise: row.nama_exercise,
    setTarget: row.set_target,
    repTarget: row.rep_target,
    urutan: row.urutan
  };
}

function findClient(id) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND arsip = 0').get(id);
}

function findPlan(id) {
  return db.prepare('SELECT * FROM plans WHERE id = ? AND arsip = 0').get(id);
}

function findDay(id) {
  const row = db
    .prepare(
      `SELECT pd.*, p.arsip AS plan_arsip FROM plan_days pd
       JOIN plans p ON p.id = pd.plan_id WHERE pd.id = ?`
    )
    .get(id);
  return row && row.plan_arsip === 0 ? row : null;
}

function findExercise(id) {
  const row = db
    .prepare(
      `SELECT pde.*, p.arsip AS plan_arsip FROM plan_day_exercises pde
       JOIN plan_days pd ON pd.id = pde.plan_day_id
       JOIN plans p ON p.id = pd.plan_id WHERE pde.id = ?`
    )
    .get(id);
  return row && row.plan_arsip === 0 ? row : null;
}

plans.get('/clients/:id/plans', (c) => {
  const clientId = parseId(c.req.param('id'));
  if (!clientId || !findClient(clientId)) {
    return c.json({ error: 'not found' }, 404);
  }

  const rows = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM plan_days pd WHERE pd.plan_id = p.id) AS day_count
       FROM plans p WHERE p.client_id = ? AND p.arsip = 0
       ORDER BY p.nama COLLATE NOCASE`
    )
    .all(clientId);

  return c.json(rows.map((row) => ({ ...planJson(row), dayCount: row.day_count })));
});

plans.get('/clients/:id/plan-days', (c) => {
  const clientId = parseId(c.req.param('id'));
  if (!clientId || !findClient(clientId)) {
    return c.json({ error: 'not found' }, 404);
  }

  const rows = db
    .prepare(
      `SELECT pd.id, pd.plan_id, p.nama AS plan_nama, pd.week_number, pd.label, pd.urutan
       FROM plan_days pd
       JOIN plans p ON p.id = pd.plan_id
       WHERE p.client_id = ? AND p.arsip = 0
       ORDER BY p.nama COLLATE NOCASE, pd.urutan ASC, pd.id ASC`
    )
    .all(clientId);

  return c.json(
    rows.map((row) => ({
      id: row.id,
      planId: row.plan_id,
      planNama: row.plan_nama,
      weekNumber: row.week_number,
      label: row.label,
      urutan: row.urutan
    }))
  );
});

plans.post('/clients/:id/plans', async (c) => {
  const clientId = parseId(c.req.param('id'));
  if (!clientId || !findClient(clientId)) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO plans (client_id, nama) VALUES (?, ?)')
      .run(clientId, parsed.data.nama);
    const created = db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid);
    logAudit(db, {
      trainerId,
      entityType: 'plans',
      entityId: created.id,
      action: 'create',
      oldValue: null,
      newValue: planJson(created)
    });
    return created;
  })();

  return c.json(planJson(row), 201);
});

plans.get('/plans/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const plan = id ? findPlan(id) : null;
  if (!plan) {
    return c.json({ error: 'not found' }, 404);
  }

  const days = db
    .prepare('SELECT * FROM plan_days WHERE plan_id = ? ORDER BY urutan ASC, id ASC')
    .all(id);
  const exercisesStmt = db.prepare(
    'SELECT * FROM plan_day_exercises WHERE plan_day_id = ? ORDER BY urutan ASC, id ASC'
  );

  return c.json({
    ...planJson(plan),
    days: days.map((day) => ({
      ...dayJson(day),
      exercises: exercisesStmt.all(day.id).map(exerciseJson)
    }))
  });
});

plans.patch('/plans/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findPlan(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = planPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  if (parsed.data.nama === undefined) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    db.prepare('UPDATE plans SET nama = ? WHERE id = ?').run(parsed.data.nama, id);
    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(id);
    logAudit(db, {
      trainerId,
      entityType: 'plans',
      entityId: id,
      action: 'update',
      oldValue: planJson(existing),
      newValue: planJson(updated)
    });
    return updated;
  })();

  return c.json(planJson(row));
});

plans.delete('/plans/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findPlan(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const trainerId = c.get('trainer').id;
  db.transaction(() => {
    db.prepare('UPDATE plans SET arsip = 1 WHERE id = ?').run(id);
    logAudit(db, {
      trainerId,
      entityType: 'plans',
      entityId: id,
      action: 'delete',
      oldValue: planJson(existing),
      newValue: { ...planJson(existing), arsip: true }
    });
  })();

  return c.json({ ok: true });
});

plans.post('/plans/:id/days', async (c) => {
  const planId = parseId(c.req.param('id'));
  const plan = planId ? findPlan(planId) : null;
  if (!plan) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = daySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const { weekNumber = null, label, urutan = 0 } = parsed.data;
  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO plan_days (plan_id, week_number, label, urutan) VALUES (?, ?, ?, ?)')
      .run(planId, weekNumber, label, urutan);
    const created = db.prepare('SELECT * FROM plan_days WHERE id = ?').get(info.lastInsertRowid);
    logAudit(db, {
      trainerId,
      entityType: 'plan_days',
      entityId: created.id,
      action: 'create',
      oldValue: null,
      newValue: dayJson(created)
    });
    return created;
  })();

  return c.json(dayJson(row), 201);
});

plans.patch('/plan-days/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findDay(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = dayPatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  const updates = [];
  const values = [];
  if (data.weekNumber !== undefined) {
    updates.push('week_number = ?');
    values.push(data.weekNumber);
  }
  if (data.label !== undefined) {
    updates.push('label = ?');
    values.push(data.label);
  }
  if (data.urutan !== undefined) {
    updates.push('urutan = ?');
    values.push(data.urutan);
  }
  if (updates.length === 0) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    db.prepare(`UPDATE plan_days SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    const updated = db.prepare('SELECT * FROM plan_days WHERE id = ?').get(id);
    logAudit(db, {
      trainerId,
      entityType: 'plan_days',
      entityId: id,
      action: 'update',
      oldValue: dayJson(existing),
      newValue: dayJson(updated)
    });
    return updated;
  })();

  return c.json(dayJson(row));
});

plans.delete('/plan-days/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findDay(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const trainerId = c.get('trainer').id;
  const exercises = db
    .prepare('SELECT * FROM plan_day_exercises WHERE plan_day_id = ?')
    .all(id);

  db.transaction(() => {
    for (const exercise of exercises) {
      db.prepare('DELETE FROM plan_day_exercises WHERE id = ?').run(exercise.id);
      logAudit(db, {
        trainerId,
        entityType: 'plan_day_exercises',
        entityId: exercise.id,
        action: 'delete',
        oldValue: exerciseJson(exercise),
        newValue: null
      });
    }
    db.prepare('DELETE FROM plan_days WHERE id = ?').run(id);
    logAudit(db, {
      trainerId,
      entityType: 'plan_days',
      entityId: id,
      action: 'delete',
      oldValue: dayJson(existing),
      newValue: null
    });
  })();

  return c.json({ ok: true });
});

plans.post('/plan-days/:id/exercises', async (c) => {
  const dayId = parseId(c.req.param('id'));
  const day = dayId ? findDay(dayId) : null;
  if (!day) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = exerciseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const { namaExercise, setTarget = null, repTarget = null, urutan = 0 } = parsed.data;
  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO plan_day_exercises
          (plan_day_id, nama_exercise, set_target, rep_target, urutan)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(dayId, namaExercise, setTarget, repTarget, urutan);
    const created = db
      .prepare('SELECT * FROM plan_day_exercises WHERE id = ?')
      .get(info.lastInsertRowid);
    logAudit(db, {
      trainerId,
      entityType: 'plan_day_exercises',
      entityId: created.id,
      action: 'create',
      oldValue: null,
      newValue: exerciseJson(created)
    });
    return created;
  })();

  return c.json(exerciseJson(row), 201);
});

plans.patch('/plan-day-exercises/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findExercise(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = exercisePatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  const updates = [];
  const values = [];
  if (data.namaExercise !== undefined) {
    updates.push('nama_exercise = ?');
    values.push(data.namaExercise);
  }
  if (data.setTarget !== undefined) {
    updates.push('set_target = ?');
    values.push(data.setTarget);
  }
  if (data.repTarget !== undefined) {
    updates.push('rep_target = ?');
    values.push(data.repTarget);
  }
  if (data.urutan !== undefined) {
    updates.push('urutan = ?');
    values.push(data.urutan);
  }
  if (updates.length === 0) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    db.prepare(`UPDATE plan_day_exercises SET ${updates.join(', ')} WHERE id = ?`).run(
      ...values,
      id
    );
    const updated = db.prepare('SELECT * FROM plan_day_exercises WHERE id = ?').get(id);
    logAudit(db, {
      trainerId,
      entityType: 'plan_day_exercises',
      entityId: id,
      action: 'update',
      oldValue: exerciseJson(existing),
      newValue: exerciseJson(updated)
    });
    return updated;
  })();

  return c.json(exerciseJson(row));
});

plans.delete('/plan-day-exercises/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findExercise(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const trainerId = c.get('trainer').id;
  db.transaction(() => {
    db.prepare('DELETE FROM plan_day_exercises WHERE id = ?').run(id);
    logAudit(db, {
      trainerId,
      entityType: 'plan_day_exercises',
      entityId: id,
      action: 'delete',
      oldValue: exerciseJson(existing),
      newValue: null
    });
  })();

  return c.json({ ok: true });
});

export default plans;
