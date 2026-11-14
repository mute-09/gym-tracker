CREATE TABLE IF NOT EXISTS trainers(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0, aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY, nama TEXT NOT NULL, berat_badan REAL,
  catatan TEXT DEFAULT '', arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY, client_id INT NOT NULL REFERENCES clients(id),
  nama TEXT NOT NULL, arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS plan_days(id INTEGER PRIMARY KEY, plan_id INT NOT NULL REFERENCES plans(id),
  week_number INTEGER, label TEXT NOT NULL, urutan INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS plan_day_exercises(id INTEGER PRIMARY KEY, plan_day_id INT NOT NULL REFERENCES plan_days(id),
  nama_exercise TEXT NOT NULL, set_target INTEGER, rep_target TEXT, urutan INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS muscle_groups(id INTEGER PRIMARY KEY, nama TEXT UNIQUE NOT NULL);

CREATE TABLE IF NOT EXISTS sessions(id INTEGER PRIMARY KEY, client_id INT NOT NULL REFERENCES clients(id),
  tanggal TEXT NOT NULL, plan_day_id INT REFERENCES plan_days(id), catatan TEXT DEFAULT '',
  arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS session_muscles(session_id INT NOT NULL REFERENCES sessions(id),
  muscle_group_id INT NOT NULL REFERENCES muscle_groups(id), PRIMARY KEY(session_id, muscle_group_id));

CREATE TABLE IF NOT EXISTS session_exercises(id INTEGER PRIMARY KEY, session_id INT NOT NULL REFERENCES sessions(id),
  nama_exercise TEXT NOT NULL, urutan INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS set_logs(id INTEGER PRIMARY KEY, session_exercise_id INT NOT NULL REFERENCES session_exercises(id),
  set_number INTEGER NOT NULL, berat REAL, reps INTEGER);

CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY, trainer_id INT NOT NULL REFERENCES trainers(id),
  entity_type TEXT NOT NULL, entity_id INT NOT NULL, action TEXT NOT NULL,
  old_value TEXT, new_value TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS auth_sessions(token TEXT PRIMARY KEY, trainer_id INT NOT NULL REFERENCES trainers(id),
  expires_at TEXT NOT NULL);

INSERT OR IGNORE INTO muscle_groups(nama) VALUES ('dada'),('punggung'),('kaki'),('bahu'),
  ('bisep'),('trisep'),('core'),('kardio');

CREATE INDEX IF NOT EXISTS idx_plans_client ON plans(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id,tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type,entity_id);
