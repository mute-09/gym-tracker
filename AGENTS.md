# Gym Tracker v2 — Multi-Trainer

Briefing kerja untuk agent/developer. Baca seluruh dokumen sebelum menulis kode.

## MISI

Web untuk TRAINER mencatat progres latihan KLIEN. User = trainer (login wajib).
Klien = record DB, bukan user. v1 (`legacy/`) dibuang total, tidak ada migrasi.

## ATURAN KERAS

1. Semua trainer melihat dan mengedit semua klien. Admin hanya berbeda di kelola akun.
2. Delete = soft (`arsip` int). TIDAK ada hard delete di UI.
3. Audit log append-only untuk CRUD `clients/plans/plan_days/plan_day_exercises/sessions/session_exercises/set_logs/trainers`. Simpan `old_value` + `new_value` JSON.
4. Auth: cookie httpOnly + SameSite=Lax + Secure. Password bcrypt (cost >= 10) atau argon2id. Password tidak pernah dikirim balik / di-log.
5. Online-first. Tidak ada sync kompleks. localStorage opsional, hanya draft form.
6. `plan_days.week_number` NULLABLE. Jangan paksa konsep minggu (PPL, Upper/Lower, 12-minggu, bebas).
7. `sessions.plan_day_id` NULLABLE. Sesi tanpa plan_day valid.
8. B1 (last-summary) dihitung di BACKEND. Frontend render saja.
9. Tanpa Docker, tanpa ORM. SQL langsung via better-sqlite3.
10. `updated_at` di-maintain oleh trigger SQLite (`trg_trainers_updated`, `trg_clients_updated`, `trg_plans_updated`, `trg_sessions_updated`). Handler TIDAK set manual. `foreign_keys = ON` wajib dan di-assert saat koneksi dibuka.

## STACK

- Backend: Node 20+, Hono, better-sqlite3, zod, cookie.
- Frontend: React + Vite + TS, fetch same-origin `/api/*`.
- Deploy: nginx + Cloudflare Tunnel, backend systemd `127.0.0.1:3000`.

## STRUKTUR

```
server/src/{index,db,auth,clients,plans,sessions,trainers,audit}.js
server/src/lib/{password,validate}.js
server/{schema.sql,seed.js,package.json}
web/src/{App.tsx,main.tsx,pages/{Login,ClientList,ClientDetail,AdminTrainers}.tsx,lib/api.ts}
deploy/{nginx.conf.snippet,gym-api.service}
ARCHITECTURE.md AGENTS.md README.md
```

`legacy/` = arsip. JANGAN dibaca, diubah, atau dijadikan referensi.

## SKEMA

```sql
CREATE TABLE trainers(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, is_admin INTEGER DEFAULT 0, aktif INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE clients(id INTEGER PRIMARY KEY, nama TEXT NOT NULL, berat_badan REAL,
  catatan TEXT DEFAULT '', arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE plans(id INTEGER PRIMARY KEY, client_id INT NOT NULL REFERENCES clients(id),
  nama TEXT NOT NULL, arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE plan_days(id INTEGER PRIMARY KEY, plan_id INT NOT NULL REFERENCES plans(id),
  week_number INTEGER, label TEXT NOT NULL, urutan INTEGER DEFAULT 0);

CREATE TABLE plan_day_exercises(id INTEGER PRIMARY KEY, plan_day_id INT NOT NULL REFERENCES plan_days(id),
  nama_exercise TEXT NOT NULL, set_target INTEGER, rep_target TEXT, urutan INTEGER DEFAULT 0);

CREATE TABLE muscle_groups(id INTEGER PRIMARY KEY, nama TEXT UNIQUE NOT NULL);

CREATE TABLE sessions(id INTEGER PRIMARY KEY, client_id INT NOT NULL REFERENCES clients(id),
  tanggal TEXT NOT NULL, plan_day_id INT REFERENCES plan_days(id), catatan TEXT DEFAULT '',
  arsip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));

CREATE TABLE session_muscles(session_id INT NOT NULL REFERENCES sessions(id),
  muscle_group_id INT NOT NULL REFERENCES muscle_groups(id), PRIMARY KEY(session_id, muscle_group_id));

CREATE TABLE session_exercises(id INTEGER PRIMARY KEY, session_id INT NOT NULL REFERENCES sessions(id),
  nama_exercise TEXT NOT NULL, urutan INTEGER DEFAULT 0);

CREATE TABLE set_logs(id INTEGER PRIMARY KEY, session_exercise_id INT NOT NULL REFERENCES session_exercises(id),
  set_number INTEGER NOT NULL, berat REAL, reps INTEGER);

CREATE TABLE audit_log(id INTEGER PRIMARY KEY, trainer_id INT NOT NULL REFERENCES trainers(id),
  entity_type TEXT NOT NULL, entity_id INT NOT NULL, action TEXT NOT NULL,
  old_value TEXT, new_value TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE auth_sessions(token TEXT PRIMARY KEY, trainer_id INT NOT NULL REFERENCES trainers(id),
  expires_at TEXT NOT NULL);

INSERT INTO muscle_groups(nama) VALUES ('dada'),('punggung'),('kaki'),('bahu'),
  ('bisep'),('trisep'),('core'),('kardio');
CREATE INDEX idx_plans_client ON plans(client_id);
CREATE INDEX idx_sessions_client ON sessions(client_id,tanggal DESC);
CREATE INDEX idx_audit_entity ON audit_log(entity_type,entity_id);
```

## PERMISSION

| Aksi | Trainer | Admin |
|---|---|---|
| login/logout/me | ✅ | ✅ |
| CRUD klien/plan/sesi | ✅ | ✅ |
| soft delete klien/plan/sesi | ✅ | ✅ |
| kelola akun trainer (`/api/trainers/*`) | ❌ | ✅ |
| lihat audit di UI | ❌ | ❌ |

Semua endpoint kecuali `POST /api/auth/login` + `GET /api/health` wajib `requireAuth`.
`/api/trainers/*` wajib `requireAdmin`.

## API

```
POST /api/auth/login|logout
GET  /api/me | /api/health

GET/POST         /api/clients
GET/PATCH/DELETE /api/clients/:id          (DELETE = soft)
GET              /api/clients/:id/last-summary
GET/POST         /api/clients/:id/plans
GET/PATCH/DELETE /api/plans/:id
POST             /api/plans/:id/days
PATCH/DELETE     /api/plan-days/:id
POST             /api/plan-days/:id/exercises
PATCH/DELETE     /api/plan-day-exercises/:id

GET/POST         /api/clients/:id/sessions
GET/PATCH/DELETE /api/sessions/:id         (DELETE = soft)

GET  /api/muscle-groups

GET/POST         /api/trainers               (admin)
PATCH            /api/trainers/:id           (admin)
```

`POST /api/clients/:id/sessions` body:

```json
{"tanggal":"YYYY-MM-DD","planDayId":null,"catatan":"","muscleGroupIds":[1,6],
 "exercises":[{"namaExercise":"Bench Press","urutan":0,
   "sets":[{"setNumber":1,"berat":60,"reps":10}]}]}
```

`GET /api/clients/:id/last-summary` response:

```json
{"session":{"id":12,"tanggal":"2026-11-12","catatan":""},"daysAgo":2,
 "muscles":[{"id":1,"nama":"dada"}],
 "exercises":[{"namaExercise":"Bench Press","topSet":{"berat":60,"reps":10}}]}
```

## FRONTEND

- **Login**: form, error inline.
- **ClientList**: tabel (nama, berat, sesi terakhir X hari lalu, Buka), tombol Tambah klien, link Admin kalau admin.
- **ClientDetail** tabs:
  - Ringkasan: render last-summary + berat + catatan.
  - Sesi: list, form buat/edit (tanggal, otot multi-select, exercises+sets, catatan, planDay opsional).
  - Plan: list + editor plan/days/exercises.
  - Profil: edit nama/berat/catatan.
- **AdminTrainers**: list trainer, buat, toggle aktif, reset password.
- `api.ts`: fetch credentials, parse `{error}`, lempar `ApiError`.
- Styling functional dulu. Tailwind/CSS modul bebas.

## MILESTONE

Satu milestone per iterasi. Setelah selesai: smoke test, commit `M<N>: <ringkas>`,
laporkan diff + hasil, BERHENTI tunggu approval. JANGAN lanjut tanpa approval.

| # | Deliverable | Selesai jika |
|---|---|---|
| M1 | Scaffold server + schema.sql + seed admin + /api/health | curl /api/health ok, admin login via curl |
| M2 | Auth login/logout/me + requireAuth/requireAdmin | Cookie set, /api/me benar, tanpa cookie 401 |
| M3 | CRUD klien + last-summary + soft delete + audit | Endpoint jalan, audit tercatat, soft delete |
| M4 | CRUD plan + plan_days + plan_day_exercises | PPL (week null) & 12-minggu (week terisi) bisa dibuat |
| M5 | CRUD sesi + exercises + sets + muscle tags | Input sesi lengkap, last-summary update |
| M6 | Admin trainers API | Admin kelola trainer, non-admin 403 |
| M7 | Vite scaffold + Login + ClientList | Login browser jalan, list tampil |
| M8 | ClientDetail Ringkasan + Sesi | Input sesi UI tercermin di Ringkasan |
| M9 | ClientDetail Plan editor + Profil | Plan & profil editable UI |
| M10 | AdminTrainers page | Admin kelola akun via UI |
| M11 | gym-api.service + nginx.conf.snippet | Jalan di server via Cloudflare Tunnel |
| M12 | ARCHITECTURE.md + README.md v2 | Dokumen sesuai app baru |

## SMOKE TEST (mulai M3)

```bash
curl -c c.txt -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<env>"}'
curl -b c.txt localhost:3000/api/me
curl -b c.txt -X POST localhost:3000/api/clients -H 'Content-Type: application/json' \
  -d '{"nama":"Budi","beratBadan":70,"catatan":""}'
curl -b c.txt localhost:3000/api/clients
curl -b c.txt -X POST localhost:3000/api/clients/1/sessions -H 'Content-Type: application/json' \
  -d '{"tanggal":"2026-11-14","planDayId":null,"catatan":"","muscleGroupIds":[1,6],"exercises":[{"namaExercise":"Bench Press","urutan":0,"sets":[{"setNumber":1,"berat":60,"reps":10}]}]}'
curl -b c.txt localhost:3000/api/clients/1/last-summary
```

## GAYA

- ESM. TS di frontend; JS/TS di backend asal konsisten.
- Validasi zod. Error `{error:"..."}` + status tepat (400/401/403/404).
- Identifier English. Komentar minimal.

## LARANGAN

- JANGAN commit ke main. JANGAN baca/ubah `legacy/`.
- JANGAN hard delete UI. JANGAN password plain. JANGAN log body berisi password.
- JANGAN CORS longgar. JANGAN paksa week_number non-null.
- JANGAN hitung B1 di frontend. JANGAN lanjut milestone tanpa approval.
