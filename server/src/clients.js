import { Hono } from 'hono';
import { z } from 'zod';
import { db } from './db.js';
import { logAudit } from './audit.js';
import { daysAgo, parseId, zodError } from './lib/validate.js';

const clients = new Hono();

const clientSchema = z.object({
  nama: z.string().trim().min(1, 'nama wajib diisi').max(200),
  beratBadan: z.number().positive().nullable().optional(),
  catatan: z.string().max(2000).optional()
});

const patchSchema = clientSchema.partial();

function serialize(row) {
  return {
    id: row.id,
    nama: row.nama,
    beratBadan: row.berat_badan,
    catatan: row.catatan ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findClient(id) {
  return db.prepare('SELECT * FROM clients WHERE id = ? AND arsip = 0').get(id);
}

clients.get('/', (c) => {
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT MAX(s.tanggal) FROM sessions s
         WHERE s.client_id = c.id AND s.arsip = 0) AS last_session_date
       FROM clients c
       WHERE c.arsip = 0
       ORDER BY c.nama COLLATE NOCASE`
    )
    .all();

  return c.json(
    rows.map((row) => ({
      ...serialize(row),
      lastSessionDate: row.last_session_date ?? null,
      daysAgo: row.last_session_date ? daysAgo(row.last_session_date) : null
    }))
  );
});

clients.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const { nama, beratBadan = null, catatan = '' } = parsed.data;
  const trainerId = c.get('trainer').id;

  const row = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO clients (nama, berat_badan, catatan) VALUES (?, ?, ?)')
      .run(nama, beratBadan, catatan);
    const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
    logAudit(db, {
      trainerId,
      entityType: 'clients',
      entityId: created.id,
      action: 'create',
      oldValue: null,
      newValue: serialize(created)
    });
    return created;
  })();

  return c.json(serialize(row), 201);
});

clients.get('/:id/last-summary', (c) => {
  const id = parseId(c.req.param('id'));
  if (!id || !findClient(id)) {
    return c.json({ error: 'not found' }, 404);
  }

  const session = db
    .prepare(
      `SELECT id, tanggal, catatan FROM sessions
       WHERE client_id = ? AND arsip = 0
       ORDER BY tanggal DESC, id DESC LIMIT 1`
    )
    .get(id);

  if (!session) {
    return c.json({ session: null, daysAgo: null, muscles: [], exercises: [] });
  }

  const muscles = db
    .prepare(
      `SELECT mg.id, mg.nama FROM session_muscles sm
       JOIN muscle_groups mg ON mg.id = sm.muscle_group_id
       WHERE sm.session_id = ? ORDER BY mg.nama`
    )
    .all(session.id);

  const topSetStmt = db.prepare(
    `SELECT berat, reps FROM set_logs WHERE session_exercise_id = ?
     ORDER BY (berat IS NULL), berat DESC, (reps IS NULL), reps DESC, set_number
     LIMIT 1`
  );

  const exercises = db
    .prepare(
      'SELECT id, nama_exercise FROM session_exercises WHERE session_id = ? ORDER BY urutan, id'
    )
    .all(session.id)
    .map((exercise) => ({
      namaExercise: exercise.nama_exercise,
      topSet: topSetStmt.get(exercise.id) ?? null
    }));

  return c.json({
    session: { id: session.id, tanggal: session.tanggal, catatan: session.catatan },
    daysAgo: daysAgo(session.tanggal),
    muscles,
    exercises
  });
});

clients.get('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const row = id ? findClient(id) : null;
  if (!row) {
    return c.json({ error: 'not found' }, 404);
  }
  return c.json(serialize(row));
});

clients.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findClient(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  const updates = [];
  const values = [];

  if (data.nama !== undefined) {
    updates.push('nama = ?');
    values.push(data.nama);
  }
  if (data.beratBadan !== undefined) {
    updates.push('berat_badan = ?');
    values.push(data.beratBadan);
  }
  if (data.catatan !== undefined) {
    updates.push('catatan = ?');
    values.push(data.catatan);
  }
  if (updates.length === 0) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  const trainerId = c.get('trainer').id;
  const row = db.transaction(() => {
    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    logAudit(db, {
      trainerId,
      entityType: 'clients',
      entityId: id,
      action: 'update',
      oldValue: serialize(existing),
      newValue: serialize(updated)
    });
    return updated;
  })();

  return c.json(serialize(row));
});

clients.delete('/:id', (c) => {
  const id = parseId(c.req.param('id'));
  const existing = id ? findClient(id) : null;
  if (!existing) {
    return c.json({ error: 'not found' }, 404);
  }

  const trainerId = c.get('trainer').id;
  db.transaction(() => {
    db.prepare('UPDATE clients SET arsip = 1 WHERE id = ?').run(id);
    const archived = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    logAudit(db, {
      trainerId,
      entityType: 'clients',
      entityId: id,
      action: 'delete',
      oldValue: serialize(existing),
      newValue: { ...serialize(archived), arsip: true }
    });
  })();

  return c.json({ ok: true });
});

export default clients;
