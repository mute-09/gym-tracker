# Deploy Gym Tracker v2

Panduan ini untuk memasang **v2 di path baru** tanpa menyentuh v1.
v1 tetap di `/home/muthi/gym-assitant/` (container `gym-tracker` port 8088).
`/home/muthi/gym-assitan` (tanpa `t`) adalah file biasa dan tidak disentuh.
v2 memakai `/home/muthi/gym-assitant-v2/`.

> Agent tidak menjalankan langkah di server. Semua perintah di bawah dijalankan
> manual oleh user. Jangan menimpa folder/konfigurasi v1.

## Prasyarat

- Node.js 20+ di server (`node -v`, `command -v node`).
- nginx aktif.
- Cloudflare Tunnel aktif dan bisa menambah public hostname.
- Build tools untuk `better-sqlite3` bila perlu kompilasi:
  `build-essential`, `python3`, `make`, `g++`.
- User sistem untuk service: `muthi`.

## 1. Salin repo ke path v2

```bash
sudo mkdir -p /home/muthi/gym-assitant-v2
sudo chown muthi:muthi /home/muthi/gym-assitant-v2

# pilih salah satu:
git clone <repo-url> /home/muthi/gym-assitant-v2
# atau dari mesin dev:
# rsync -av --exclude node_modules --exclude data --exclude web/dist \
#   /path/ke/gym-asistant/ /home/muthi/gym-assitant-v2/
```

Pastikan folder v1 tidak berubah.

## 2. Install dependency backend

```bash
cd /home/muthi/gym-assitant-v2/server
npm ci --omit=dev
```

## 3. Siapkan environment

```bash
cd /home/muthi/gym-assitant-v2
cp deploy/.env.production.example .env
chmod 600 .env
nano .env
```

Isi semua placeholder di `.env` sesuai komentar template. Minimal:

- port backend (default 3005),
- path database absolut ke `data/gym.db` v2,
- secret acak dari `openssl rand -hex 32`,
- username admin,
- password admin (minimal 8 karakter).

Jangan commit `.env`. File ini sudah di-ignore.

## 4. Seed admin

`npm run seed` tidak membaca `.env` otomatis, jadi muat dulu ke shell:

```bash
cd /home/muthi/gym-assitant-v2/server
set -a
. ../.env
set +a
npm run seed
```

Ini membuat database dan akun admin. Menjalankan seed lagi akan meng-update
password admin yang sudah ada.

## 5. Build frontend

```bash
cd /home/muthi/gym-assitant-v2/web
npm ci
npm run build
```

Hasil build harus ada di `/home/muthi/gym-assitant-v2/web/dist/index.html`
dan `web/dist/assets/`.

## 6. Pasang systemd service

```bash
cd /home/muthi/gym-assitant-v2
sudo cp deploy/gym-api.service /etc/systemd/system/gym-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now gym-api

systemctl status gym-api --no-pager
journalctl -u gym-api -n 50 --no-pager
```

Unit memakai `/usr/local/bin/node` (Node v24.22.1 di server). Jika lokasinya
berbeda, edit `ExecStart` di `/etc/systemd/system/gym-api.service` memakai hasil:

```bash
command -v node
```

lalu `sudo systemctl daemon-reload && sudo systemctl restart gym-api`.

## 7. Tambahkan konfigurasi nginx v2

Buat **server block baru** untuk v2. Jangan ubah server block v1.

Contoh kerangka (sesuaikan port/TLS dengan setup v2):

```nginx
server {
    listen <port-nginx-v2>;
    server_name <hostname-v2>;
    include /home/muthi/gym-assitant-v2/deploy/nginx.conf.snippet;
}
```

Atau salin isi `deploy/nginx.conf.snippet` ke dalam server block v2. Snippet
sudah mengatur:

- `root` ke `web/dist`,
- proxy `/api/` ke `127.0.0.1:3005`,
- cache aset,
- SPA fallback `try_files $uri $uri/ /index.html` supaya refresh
  `/clients/:id` tidak 404.

Lalu:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Cloudflare Tunnel

Di dashboard Cloudflare Zero Trust → Tunnels, tambahkan public hostname v2:

- hostname: hostname v2 yang kamu pilih,
- service: origin nginx v2, misalnya `http://localhost:<port-nginx-v2>`
  (atau `https://localhost:443` jika nginx v2 memakai TLS lokal).

TLS publik diterminasi Cloudflare. Tidak perlu hardcode domain di repo.

## 9. Verifikasi

```bash
curl -f https://<hostname-v2>/api/health
# {"ok":true}

curl -I https://<hostname-v2>/clients/1
# harus 200 (SPA fallback), bukan 404
```

Lalu buka `https://<hostname-v2>/`, login, refresh halaman detail klien, dan
pastikan sesi tetap valid.

## 10. Rollback

v1 tidak disentuh, jadi rollback cukup mematikan v2:

```bash
sudo systemctl stop gym-api
# hapus/disable server block v2 dari nginx, lalu:
sudo nginx -t && sudo systemctl reload nginx
```

Opsional: `sudo systemctl disable gym-api`.

Data v2 tetap ada di `/home/muthi/gym-assitant-v2/data/`.

## 11. Backup harian

Contoh cron (sesuaikan jam):

```bash
crontab -e
```

```cron
0 3 * * * cp /home/muthi/gym-assitant-v2/data/gym.db /home/muthi/gym-assitant-v2/data/gym.db.bak-$(date +\%F)
```

Database memakai WAL. Untuk backup yang konsisten saat service berjalan,
lebih baik gunakan `sqlite3`:

```bash
sqlite3 /home/muthi/gym-assitant-v2/data/gym.db \
  ".backup '/home/muthi/gym-assitant-v2/data/gym.db.bak-$(date +%F)'"
```

## Bantuan `deploy.sh`

`deploy/deploy.sh` hanya menjalankan `npm ci` + build frontend dan mencetak
langkah manual. Script ini **tidak** melakukan SSH, rsync, atau deploy otomatis.
Jalankan dari mesin dev bila mau:

```bash
./deploy/deploy.sh
```

## Troubleshooting singkat

- Service gagal start: cek `journalctl -u gym-api`, pastikan `.env` ada,
  permission DB, dan path Node benar.
- `502 Bad Gateway`: backend tidak jalan atau `PORT` tidak cocok dengan
  `proxy_pass`.
- Refresh halaman 404: SPA fallback tidak terpasang atau `root` salah.
- Cookie tidak tersimpan: akses lewat HTTPS (cookie `Secure` aktif).
