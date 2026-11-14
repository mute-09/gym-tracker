#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Gym Tracker v2 build =="
echo "Repo: $ROOT"

echo
echo "== server dependencies =="
(cd "$ROOT/server" && npm ci --omit=dev)

echo
echo "== web build =="
(cd "$ROOT/web" && npm ci && npm run build)

if [[ ! -f "$ROOT/web/dist/index.html" ]]; then
  echo "ERROR: web/dist/index.html tidak ditemukan" >&2
  exit 1
fi

cat <<'EOF'

Build selesai. Script ini TIDAK melakukan SSH, rsync, atau deploy otomatis.

Langkah manual di server:
1. Salin repo/build ke /home/muthi/gym-assitant-v2 (jangan menimpa v1).
2. Siapkan /home/muthi/gym-assitant-v2/.env dari deploy/.env.production.example,
   isi nilainya, lalu: chmod 600 .env
3. Seed admin dari folder server dengan env dimuat:
   set -a; . ../.env; set +a; npm run seed
4. Pasang deploy/gym-api.service, lalu:
   sudo systemctl daemon-reload && sudo systemctl enable --now gym-api
5. Tambahkan deploy/nginx.conf.snippet ke server block v2, lalu:
   sudo nginx -t && sudo systemctl reload nginx
6. Verifikasi: curl -f https://<hostname-v2>/api/health

Detail lengkap: DEPLOY.md
EOF
