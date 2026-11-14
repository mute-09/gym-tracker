import { db } from './src/db.js';
import { hashPassword } from './src/lib/password.js';

const username = process.env.ADMIN_USERNAME || 'admin';
const password = process.env.ADMIN_PASSWORD;

if (!password || !password.trim()) {
  console.error('ADMIN_PASSWORD is required and must not be blank');
  process.exit(1);
}

const hash = await hashPassword(password);

db.prepare(
  `INSERT INTO trainers (username, password_hash, is_admin, aktif)
   VALUES (?, ?, 1, 1)
   ON CONFLICT(username) DO UPDATE SET
     password_hash = excluded.password_hash,
     is_admin = 1,
     aktif = 1,
     updated_at = datetime('now')`
).run(username, hash);

console.log(`seeded admin account: ${username}`);
