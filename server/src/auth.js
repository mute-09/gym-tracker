import { z } from 'zod';
import { db } from './db.js';
import { verifyPassword } from './lib/password.js';
import { setCookie } from 'hono/cookie';
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
  db.prepare('INSERT INTO auth_sessions (token, trainer_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    trainer.id,
    expiresAt()
  );

  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });

  return c.json({
    trainer: { id: trainer.id, username: trainer.username, isAdmin: trainer.is_admin === 1 }
  });
}

export { COOKIE_NAME };
