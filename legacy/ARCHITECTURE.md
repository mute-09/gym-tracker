# Arsitektur & Teknologi — Gym Tracker

Dokumen ini ditujukan untuk pengembang berikutnya yang akan melanjutkan pengembangan aplikasi ini. Ditulis dengan gampang dipahami (tidak perlu mahir).

---

## 1. Apa itu aplikasi ini?

Gym Tracker adalah aplikasi catatan latihan gym 12 minggu ("Athletic Lean Program"). Pengguna bisa:

- Lihat rencana latihan per hari (Senin–Minggu) dalam satu minggu.
- Pilih lokasi latihan: **Gym** atau **Home**.
- Catat berat dan repetisi per set untuk setiap latihan.
- Tandai latihan/hari sebagai selesai.
- Lihat progres (persentase, streak, total volume).
- Edit program latihan di tab "Plan Editor".
- Cadangkan & pulihkan data lewat file JSON (Ekspor/Impor).

Semua data disimpan di **browser pengguna (localStorage)**, bukan di server. Jadi progres tidak hilang saat halaman di-refresh, tapi akan hilang jika cache browser dibersihkan — kecuali jika pengguna mengeksport cadangan dulu.

---

## 2. Stack Teknologi

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Bahasa | HTML5, CSS3, JavaScript (ES6+) | Tidak ada framework (React/Vue/etc). Semua vanilla. |
| Tampilan | CSS internal di `<style>` di index.html | Menggunakan CSS variables (mis. `--primary`, `--bg-card`) untuk warna dan tema. |
| Animasi tema | Fun mode (`Ctrl+Shift+F`) | Ganti warna pakai class `.fun-mode` di `<html>`. |
| Bahasa (i18n) | Objek `I18N` di JavaScript | Dukungan Bahasa Indonesia (`id`) dan Inggris (`en`). Disimpan di `localStorage` kunci `gymTrackerLang`. |
| Penyimpanan | Browser `localStorage` | Kunci utama: `gymTrackerData`, `gymTrackerPlan`, `gymTrackerLocation`, `gymTrackerWeek`. |
| Data latihan | `exercise-guides.js` | Berisi objek `EXERCISE_GUIDES` (GIF, gambar, langkah gerakan) untuk panduan gerakan. |
| Build tool | Tidak ada | Buka `index.html` langsung di browser. Tidak perlu npm/node build. |
| Server | Statis | Hanya perlu file disajikan oleh web server (nginx) atau bisa dibuka langsung sebagai file. |

---

## 3. Struktur File

```
index.html          -> Satu file berisi HTML + CSS + JavaScript (utama)
exercise-guides.js  -> Data panduan gerakan latihan (GIF/gambar/langkah)
README.md           -> Panduan pengguna singkat
DEPLOYMENT.md       -> Panduan deploy (nginx + Cloudflare)
ARCHITECTURE.md     -> Dokumen ini (untuk pengembang)
assets/             -> Folder aset gambar (logo, favicon, dll.)
deploy.sh           -> Skrip bantu deploy/setup nginx
```

**Penting:** Semua logika aplikasi ada di satu file `index.html` (bagian `<script>` di bawah). Jika ingin menambah fitur, banyak kemungkinan dilakukan hanya dengan mengedit file ini.

---

## 4. Arsitektur Aplikasi (Ringkasan)

Aplikasi dibagi menjadi dua tab:

### Tab "Dashboard"
- **Sidebar**: progres program, statistik (total latihan, streak, volume), parameter latihan, cadangan data (Ekspor/Impor).
- **Week Grid**: 7 kartu hari. Setiap hari menunjukkan status selesai/belum (satu badge per hari, bukan per Gym/Home).
- **Workout Detail**: daftar latihan hari yang dipilih, dengan input berat & reps per set, dan tombol "Selesai".

### Tab "Plan Editor"
- Pengaturan latihan per hari (Senin–Minggu).
- Tambah/hapus/pindah urutan latihan.
- Simpan program ke `localStorage`.

---

## 5. Struktur Data (Penting untuk Pengembang)

Semua data latihan tersimpan di variabel global `workoutData` dan disinkronkan ke `localStorage` kunci `gymTrackerData`.

Kunci data tiap hari berbentuk:
```
week{minggu}_day{hari}
```
Contoh: `week1_day2` = Minggu 1, Hari 2 (Selasa).

Isi tiap hari:
```js
{
  exercises: {
    "ex_1_1730000000000": {
      completed: true,        // latihan ini ditandai selesai
      setLogs: [              // catatan per set
        { weight: 20, reps: 10 },
        { weight: 22, reps: 10 },
        { weight: 25, reps: 8 }
      ],
      weight: '',             // legacy (single weight, masih dipertahankan untuk kompatibilitas)
      sets: '',
      reps: ''
    }
  },
  completed: true,            // hari ditandai selesai (jika semua latihan dalam salah satu mode selesai)
  location: 'gym',            // lokasi terakhir yang dipilih
  progress: 100,              // persentase progres hari ini
  volume: 670                 // total volume (kg) hari ini
}
```

Daftar semua latihan program tersimpan di variabel global `allExercises` dan disimpan ke `localStorage` kunci `gymTrackerPlan`:
```js
{
  id: "ex_1_1730000000000",
  name: "Chest Press Machine",
  day: 1,                     // 1=Senin, ..., 7=Minggu
  equipment: "Gym",           // Gym / Home / Recovery / Semua
  weight: "",
  sets: "3 × 8–12",
  reps: "8–12"
}
```

Lokasi latihan yang aktif disimpan di `gymTrackerLocation` (`gym` atau `home`).
Minggu yang sedang dilihat disimpan di `gymTrackerWeek`.

---

## 6. Fungsi Penting yang Harus Diketahui

Berikut fungsi-fungsi utama di `index.html` yang sering akan kamu sentuh:

| Fungsi | Tujuan |
|--------|--------|
| `saveData()` | Simpan `workoutData` ke `localStorage`. Panggil setelah mengubah data latihan. |
| `savePlan()` | Simpan `allExercises` (program latihan) ke `localStorage`. |
| `updateExerciseData(week, day, exerciseId, field, value)` | Ubah satu field latihan (legacy, untuk kompatibilitas data lama). |
| `updateSetLog(week, day, exerciseId, setIndex, field, value)` | Ubah berat/reps pada **satu set tertentu**. Gunakan ini untuk input per set. |
| `toggleExerciseCompletion(week, day, exerciseId)` | Tandai/batalin satu latihan sebagai selesai. Akan cek apakah seluruh hari sudah selesai. |
| `renderWorkoutDay()` | Menggambar ulang tampilan detail latihan hari ini. Panggil setelah data berubah. |
| `renderWeekGrid()` | Menggambar ulang 7 kartu hari di week grid. |
| `updateDashboard()` | Perbarui statistik dan progress bar di sidebar. |
| `setLocationMode(mode)` | Ganti lokasi latihan (`gym` atau `home`). |
| `exportData()` / `importData(fileInput)` | Cadangkan & pulihkan semua data ke/from file JSON. |
| `getSetCount(prescription)` | Hitung jumlah set dari teks resep (mis. "3 × 8–12" → 3). |
| `ensureSetLogs(exerciseData, setCount)` | Buat/migrasikan array `setLogs` agar panjangnya sama dengan jumlah set. |
| `isDayComplete(week, day)` | Cek apakah suatu hari sudah selesai (level hari, bukan per lokasi). |
| `switchTab(tabName)` | Pindah antara tab 'dashboard' dan 'planner'. |

---

## 7. Cara Menambah Fitur Baru (Panduan Singkat)

1. **Buka `index.html`**, cari bagian `<script>` di paling bawah.
2. Tambahkan fungsi JavaScript baru di dalam tag `<script>`.
3. Jika butuh tampilan baru, tambahkan elemen HTML dan tambahkan style CSS di bagian `<style>` di atas.
4. Jika butuh menyimpan data baru, gunakan `localStorage.setItem('kunciBaru', JSON.stringify(data))` dan panggil `saveData()` jika terkait latihan.
5. Setelah edit, coba buka `index.html` langsung di browser untuk memastikan tidak ada error. Buka console devtools (`F12`) untuk lihat error JavaScript.

---

## 8. Tips untuk Developer Pemula

- **Jangan gunakan framework.** Aplikasi ini sengaja vanilla JS agar mudah dipelihara dan tidak butuh build step.
- **Semua state ada di memori (variabel global)** dan disinkronkan ke `localStorage`. Jika ingin menambah data yang perlu tersimpan, tambahkan ke `workoutData` atau `allExercises`, lalu panggil `saveData()` / `savePlan()`.
- **Hati-hati dengan nama kunci `localStorage`.** Jika kamu ganti nama kunci, data lama akan hilang atau tidak terbaca. Selalu cek dulu kunci yang sudah ada (`gymTrackerData`, `gymTrackerPlan`, `gymTrackerLocation`, `gymTrackerLang`, `gymTrackerWeek`).
- **Data per set sekarang pakai `setLogs`** (array). Jangan pakai satu field `weight` saja untuk catatan baru, kecuali untuk kompatibilitas data lama.
- **Teks aplikasi pakai sistem `t('kunci')`** (lihat objek `I18N`). Jika menambah teks UI baru, tambahkan kunci ke kedua bahasa (`id` dan `en`) agar tidak error saat ganti bahasa.
- **Tidak ada backend/database.** Tidak perlu mengatur server untuk mengembangkan fitur frontend. Cukup edit file dan refresh browser.

---

## 9. Deploy (Singkat)

Lihat `DEPLOYMENT.md` untuk detail lengkap. Ringkasan:

- Aplikasi adalah file statis. Cukpkan menyalin folder ke folder yang disajikan web server (mis. nginx).
- Di server production (lenovo), file berada di `/home/muthi/gym-assitan/` dan disajikan oleh nginx + Cloudflare Tunnel.
- Tidak ada database server. Data progres pengguna tetap di browser masing-masing.

---

## 10. Kontak / Catatan

Jika ada pertanyaan tentang logika tertentu, coba cari fungsi terkait di tabel bagian 6 atau gunakan pencarian kata kunci di `index.html`. Semua komentar dalam kode sengaja minim, jadi dokumen ini adalah panduan utama untuk memahami alur aplikasi.
