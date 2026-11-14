import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, '..', 'schema.sql');

const dbPath = process.env.DB_PATH || path.join(here, '..', 'data', 'gym.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
if (db.pragma('foreign_keys', { simple: true }) !== 1) {
  throw new Error('foreign_keys pragma failed to enable');
}

// Idempotent one-off migration: rebuild sessions if plan_day_id lacks ON DELETE SET NULL.
function migrateSessionsPlanDayFk() {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'")
    .get();
  if (!table) return;

  const fk = db.pragma("foreign_key_list('sessions')").find((row) => row.from === 'plan_day_id');
  if (!fk || fk.on_delete === 'SET NULL') return;

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE sessions_new (
          id INTEGER PRIMARY KEY,
          client_id INT NOT NULL REFERENCES clients(id),
          tanggal TEXT NOT NULL,
          plan_day_id INT REFERENCES plan_days(id) ON DELETE SET NULL,
          catatan TEXT DEFAULT '',
          arsip INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO sessions_new
          (id, client_id, tanggal, plan_day_id, catatan, arsip, created_at, updated_at)
        SELECT id, client_id, tanggal, plan_day_id, catatan, arsip, created_at, updated_at
        FROM sessions;
        DROP TABLE sessions;
        ALTER TABLE sessions_new RENAME TO sessions;
      `);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  const violations = db.pragma('foreign_key_check');
  if (violations.length > 0) {
    throw new Error('foreign_key_check failed after sessions migration');
  }
  console.warn('migrated sessions.plan_day_id to ON DELETE SET NULL');
}

migrateSessionsPlanDayFk();
db.exec(fs.readFileSync(schemaPath, 'utf8'));
