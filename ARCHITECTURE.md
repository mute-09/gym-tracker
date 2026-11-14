# Architecture — Gym Tracker v2

Aplikasi multi-trainer untuk mencatat progres latihan klien. v1 diarsipkan di
`legacy/` dan tidak dipakai sebagai referensi.

## Prinsip

- **Trainer adalah user**, klien adalah record database.
- **Online-first**: semua data di server; tidak ada sinkronisasi offline.
- **Soft delete** (`arsip = 1`) untuk klien, plan, dan sesi.
- **Audit append-only** untuk semua perubahan data.
- **SQL langsung** via `better-sqlite3`; tanpa ORM, tanpa Docker.

## Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| HTTP | Hono (`@hono/node-server`) |
| DB | SQLite via `better-sqlite3` |
| Validasi | zod |
| Auth | cookie httpOnly, token acak di `auth_sessions` |
| Hash password | bcrypt (cost 12) |
| Frontend | React + Vite + TypeScript |
| Serve | nginx statis + proxy `/api` ke `127.0.0.1:3005` |
| Tunnel | Cloudflare Tunnel |

## Layout

```
server/
  schema.sql            # skema SQLite (sumber kebenaran)
  seed.js               # seed admin dari env
  src/index.js          # bootstrap Hono, mount route
  src/db.js             # koneksi + inisialisasi schema
  src/auth.js           # login/logout/me, requireAuth, requireAdmin
  src/clients.js        # CRUD klien + last-summary
  src/plans.js          # CRUD plan, plan_days, plan_day_exercises
  src/sessions.js       # CRUD sesi + exercises + sets + muscle tags
  src/trainers.js       # admin-only account management
  src/audit.js          # penulisan audit log
  src/lib/password.js   # hash/verify
  src/lib/validate.js   # helper zod
web/
  src/App.tsx
  src/main.tsx
  src/pages/{Login,ClientList,ClientDetail,AdminTrainers}.tsx
  src/lib/api.ts
deploy/
  gym-api.service
  nginx.conf.snippet
  .env.production.example
  deploy.sh             # build helper lokal, tanpa SSH/rsync
DEPLOY.md               # panduan deploy produksi
```

## Data Model

Entitas utama:

- `trainers` — akun login; `is_admin` membedakan hak kelola akun.
- `clients` — data klien milik trainer secara kolektif (semua trainer bisa akses).
- `plans` → `plan_days` → `plan_day_exercises` — template program.
  `week_number` nullable agar PPL, Upper/Lower, 12 minggu, atau bebas semuanya valid.
- `sessions` → `session_exercises` → `set_logs` — catatan latihan aktual.
  `plan_day_id` nullable agar sesi bebas tetap valid.
- `session_muscles` — tag otot per sesi (many-to-many ke `muscle_groups`).
- `audit_log` — jejak CRUD, append-only.
- `auth_sessions` — token sesi login dengan masa berlaku.

Skema lengkap ada di `server/schema.sql`.

## Auth & Authorization

1. `POST /api/auth/login` memverifikasi password (bcrypt), membuat token acak,
   menyimpan hash/row di `auth_sessions`, lalu mengeset cookie:
   `HttpOnly; SameSite=Lax; Secure; Path=/`.
2. Middleware `requireAuth` membaca cookie, mencocokkan token yang belum
   kedaluwarsa, dan melampirkan trainer ke context. Gagal → `401`.
3. `requireAdmin` membutuhkan `is_admin = 1`. Gagal → `403`.
4. Hanya `POST /api/auth/login` dan `GET /api/health` yang publik.
5. Password tidak pernah dikembalikan di response dan tidak pernah dicatat.

## Audit

Setiap mutasi pada `clients`, `plans`, `plan_days`, `plan_day_exercises`,
`sessions`, `session_exercises`, `set_logs`, dan `trainers` menulis satu baris
`audit_log` berisi `trainer_id`, `entity_type`, `entity_id`, `action`,
`old_value` (JSON), dan `new_value` (JSON). Audit tidak diekspos ke UI.

## Last Summary (B1)

`GET /api/clients/:id/last-summary` dihitung sepenuhnya di backend:

- Ambil sesi terbaru (non-arsip) klien.
- Hitung `daysAgo` dari tanggal sesi.
- Kumpulkan muscle tags.
- Untuk setiap exercise, ambil top set (berat terbesar, lalu reps).

Frontend hanya merender response; tidak ada perhitungan di klien.

## Frontend

- `App.tsx` mengatur status login dan navigasi sederhana.
- `api.ts` selalu `credentials: 'include'`, mem-parse `{error}` dan melempar
  `ApiError`.
- Halaman: `Login`, `ClientList`, `ClientDetail` (tab Ringkasan, Sesi, Plan,
  Profil), `AdminTrainers`.
- Styling fungsional; tidak ada state global tambahan.

## Deployment

- **v1** tetap di `/home/muthi/gym-assitant/` (container `gym-tracker` port
  8088) dan tidak disentuh oleh v2; `/home/muthi/gym-assitan` adalah file biasa
  yang juga tidak disentuh.
- **v2** dipasang di `/home/muthi/gym-assitant-v2/` dengan hostname terpisah.
- Backend systemd `deploy/gym-api.service`:
  - `User=muthi`
  - `WorkingDirectory=/home/muthi/gym-assitant-v2/server`
  - `ExecStart=/usr/local/bin/node src/index.js`
  - `EnvironmentFile=/home/muthi/gym-assitant-v2/.env`
  - listen `127.0.0.1:3005` (`PORT` di `.env`)
- Database SQLite persisten di
  `/home/muthi/gym-assitant-v2/data/gym.db` melalui `DB_PATH` absolut.
- Frontend statis `web/dist/` disajikan nginx v2; `/api/` di-proxy ke
  `127.0.0.1:3005` dengan same-origin (tanpa CORS longgar).
- SPA fallback (`try_files $uri $uri/ /index.html`) wajib agar refresh route
  seperti `/clients/:id` tidak 404.
- Cloudflare Tunnel v2 menerminasi TLS dan meneruskan ke nginx v2; cookie
  `Secure` tetap valid.
- Panduan langkah demi langkah ada di `DEPLOY.md`; artefak di `deploy/`.

## Invariants

- Tidak ada hard delete dari UI.
- `week_number` dan `plan_day_id` boleh `NULL`.
- Semua endpoint kecuali health/login membutuhkan auth.
- Audit tidak bisa diubah/dihapus dari API.
