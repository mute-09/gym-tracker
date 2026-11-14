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
db.exec(fs.readFileSync(schemaPath, 'utf8'));
