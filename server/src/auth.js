import { z } from 'zod';
import { db } from './db.js';
import { verifyPassword } from './lib/password.js';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomBytes } from 'node:crypto';

const SESSION_DAYS = 7;
const COOKIE_NAME = 'gym_session';

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
});

function expiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function cookieSecure() {
  return process.env.COOKIE_SECURE !== 'false';
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure(),
    path: '/'
  };
}

export function requireAuth(c, next) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const trainer = db
    .prepare(
      `SELECT t.id, t.username, t.is_admin
       FROM auth_sessions s
       JOIN trainers t ON t.id = s.trainer_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND t.aktif = 1`
    )
    .get(token);

  if (!trainer) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  c.set('trainer', {
    id: trainer.id,
    username: trainer.username,
    isAdmin: trainer.is_admin === 1
  });

  return next();
}

export function requireAdmin(c, next) {
  const trainer = c.get('trainer');
  if (!trainer || !trainer.isAdmin) {
    return c.json({ error: 'forbidden' }, 403);
  }
  return next();
}

export async function login(c) {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid body' }, 400);
  }

  const { username, password } = parsed.data;
  const trainer = db
    .prepare('SELECT id, username, password_hash, is_admin, aktif FROM trainers WHERE username = ?')
    .get(username);

  const valid = trainer ? await verifyPassword(password, trainer.password_hash) : false;

  if (!trainer || !valid || trainer.aktif !== 1) {
    return c.json({ error: 'invalid credentials' }, 401);
  }

  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM auth_sessions WHERE expires_at <= datetime(\'now\')').run();
  db.prepare('INSERT INTO auth_sessions (token, trainer_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    trainer.id,
    expiresAt()
  );

  setCookie(c, COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });

  return c.json({
    trainer: { id: trainer.id, username: trainer.username, isAdmin: trainer.is_admin === 1 }
  });
}

export function logout(c) {
  const token = getCookie(c, COOKIE_NAME);
  if (token) {
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
  }
  deleteCookie(c, COOKIE_NAME, cookieOptions());
  return c.json({ ok: true });
}

export function me(c) {
  return c.json({ trainer: c.get('trainer') });
}

export const sessionCookieName = COOKIE_NAME;
