# Gym Tracker v2

Aplikasi web multi-trainer untuk mencatat progres latihan klien. Trainer login,
klien adalah record database. v1 lama diarsipkan di `legacy/` dan tidak dipakai.

## Development

Prasyarat: Node.js 20+ dan npm.

### Backend

```bash
cp server/.env.example .env
# edit .env bila perlu; untuk dev lewat HTTP, matikan cookie secure
cd server
npm ci
set -a; . ../.env; set +a
npm run seed
npm run dev
```

Backend berjalan di `http://127.0.0.1:3000`. `npm run seed` membuat akun admin
dari nilai di `.env`.

### Frontend

```bash
cd web
npm ci
npm run dev -- --host 127.0.0.1
```

Buka `http://127.0.0.1:5173`. Vite mem-proxy `/api` ke backend port 3000.

### Build

```bash
cd web
npm run build
```

Hasil build ada di `web/dist/`.

## Deploy

Panduan produksi lengkap ada di [DEPLOY.md](DEPLOY.md). Ringkasnya:

- v1 tetap di `/home/muthi/gym-assitan/` dan tidak disentuh.
- v2 dipasang di `/home/muthi/gym-assitan-v2/`.
- Backend via systemd `gym-api`, listen `127.0.0.1:3005`.
- Frontend statis `web/dist/` disajikan nginx, `/api/` di-proxy ke backend.
- Akses publik lewat Cloudflare Tunnel.

Artefak deploy ada di `deploy/`:

- `gym-api.service`
- `nginx.conf.snippet`
- `.env.production.example`
- `deploy.sh` (build helper, tidak melakukan SSH/rsync)

## Dokumentasi

- [DEPLOY.md](DEPLOY.md) — langkah deploy, verifikasi, rollback, backup.
- [ARCHITECTURE.md](ARCHITECTURE.md) — arsitektur dan keputusan teknis.
- [AGENTS.md](AGENTS.md) — aturan kerja dan spesifikasi milestone.
