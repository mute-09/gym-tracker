import { Hono } from 'hono';
import { z } from 'zod';
import { db } from './db.js';
import { logAudit } from './audit.js';
import { requireAdmin } from './auth.js';
import { hashPassword } from './lib/password.js';
import { parseId, zodError } from './lib/validate.js';

const trainers = new Hono();

trainers.use('*', requireAdmin);

const createSchema = z.object({
  username: z.string().trim().min(1, 'username wajib diisi').max(100),
  password: z.string().min(8, 'password minimal 8 karakter').max(200),
  isAdmin: z.boolean().optional()
});

const patchSchema = z.object({
  aktif: z.boolean().optional(),
  password: z.string().min(8, 'password minimal 8 karakter').max(200).optional()
});

function serialize(row) {
  return {
    id: row.id,
    username: row.username,
    isAdmin: row.is_admin === 1,
    aktif: row.aktif === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isUniqueUsername(err) {
  return (
    err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    /UNIQUE constraint failed: trainers\.username/.test(err?.message || '')
  );
}

trainers.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM trainers ORDER BY username COLLATE NOCASE').all();
  return c.json(rows.map(serialize));
});

trainers.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const { username, password, isAdmin = false } = parsed.data;
  const passwordHash = await hashPassword(password);
  const trainerId = c.get('trainer').id;

  try {
    const row = db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO trainers (username, password_hash, is_admin, aktif) VALUES (?, ?, ?, 1)'
        )
        .run(username, passwordHash, isAdmin ? 1 : 0);
      const created = db.prepare('SELECT * FROM trainers WHERE id = ?').get(info.lastInsertRowid);

      logAudit(db, {
        trainerId,
        entityType: 'trainers',
        entityId: created.id,
        action: 'create',
        oldValue: null,
        newValue: serialize(created)
      });

      return created;
    })();

    return c.json(serialize(row), 201);
  } catch (err) {
    if (isUniqueUsername(err)) {
      return c.json({ error: 'username sudah dipakai' }, 409);
    }
    throw err;
  }
});

trainers.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  const target = id ? db.prepare('SELECT * FROM trainers WHERE id = ?').get(id) : null;
  if (!target) {
    return c.json({ error: 'not found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: zodError(parsed) }, 400);
  }

  const data = parsed.data;
  if (data.aktif === undefined && data.password === undefined) {
    return c.json({ error: 'no fields to update' }, 400);
  }

  if (data.aktif === false && id === c.get('trainer').id) {
    return c.json({ error: 'tidak bisa menonaktifkan akun sendiri' }, 400);
  }

  const passwordHash = data.password !== undefined ? await hashPassword(data.password) : null;
  const actorId = c.get('trainer').id;

  const row = db.transaction(() => {
    if (data.aktif !== undefined) {
      db.prepare('UPDATE trainers SET aktif = ? WHERE id = ?').run(data.aktif ? 1 : 0, id);
    }
    if (passwordHash) {
      db.prepare('UPDATE trainers SET password_hash = ? WHERE id = ?').run(passwordHash, id);
    }
    if (data.aktif === false || passwordHash) {
      db.prepare('DELETE FROM auth_sessions WHERE trainer_id = ?').run(id);
    }

    const updated = db.prepare('SELECT * FROM trainers WHERE id = ?').get(id);

    logAudit(db, {
      trainerId: actorId,
      entityType: 'trainers',
      entityId: id,
      action: 'update',
      oldValue: serialize(target),
      newValue: {
        ...serialize(updated),
        ...(passwordHash ? { passwordChanged: true } : {})
      }
    });

    return updated;
  })();

  return c.json(serialize(row));
});

export default trainers;
