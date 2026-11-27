# Changelog

Semua perubahan penting pada aplikasi Gym Tracker (v1, `index.html`).

## [Unreleased]

### Fixed
- **Input set pertama pada hari yang belum pernah disimpan sekarang tersimpan.**
  Sebelumnya `updateSetLog()` berhenti diam-diam ketika `setLogs` masih kosong, sehingga
  berat/reps yang diketik pada hari baru tidak pernah masuk ke `localStorage` — akibatnya
  tidak ada catatan yang bisa dilaporkan. Sekarang slot set dibuat otomatis.
- **Statistik "Hari Beruntun" tidak lagi selalu 0.** `currentStreak` sebelumnya tidak pernah
  diisi; sekarang dihitung oleh `computeStreak()`.
- **Total volume di dashboard dihitung ulang dari `setLogs`**, sehingga angkanya sama dengan
  total di tab Laporan (field `volume` lama bisa basi).
- Pilihan jumlah set kini memuat **1 set** (sebelumnya hanya 2–6, padahal cardio/plank
  memakai 1 set).

### Added
- **Tab Laporan**: kartu ringkasan (sesi, total set, volume, rata-rata volume, hari selesai,
  minggu aktif, streak), grafik volume per minggu, ringkasan mingguan, progres per latihan,
  dan riwayat sesi dengan tanggal & rincian set. Filter minggu dan filter latihan.
- **Ekspor CSV** dan **Cetak** (print stylesheet) dari tab Laporan.
- **Timestamp pencatatan**: setiap set menyimpan `loggedAt`, setiap hari menyimpan
  `firstLoggedAt` / `lastLoggedAt`, dan `completedAt` saat hari ditandai selesai.
  Data lama tanpa timestamp tetap tampil (tanggal "—").
- Tombol **Lihat Laporan** di sidebar dashboard untuk akses cepat.
