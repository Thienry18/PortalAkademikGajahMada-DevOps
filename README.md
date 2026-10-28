# Portal Akademik SMA Gajah Mada Binjai

## Docker dan CI/CD (repo DevOps)

Empat container terpisah: **frontend**, **backend**, **database MySQL**, dan **gateway Nginx**.

```powershell
./scripts/init-env.ps1
docker compose up -d --build --wait --wait-timeout 240
npm run test:smoke
```

Akses aplikasi: http://127.0.0.1:8080. Panduan arsitektur, akun demo, deployment lokal, runner, dan rollback tersedia di [docs/DEVOPS.md](docs/DEVOPS.md).

Workflow [CI-CD Docker](.github/workflows/ci-cd.yml) membangun dan menguji empat container, mempublikasikan tiga image aplikasi ke GHCR, lalu deploy ke Docker Desktop melalui runner Windows lokal. Repo ini mempertahankan riwayat kode dari [Frederycho77/PortalAkademikGajahMada](https://github.com/Frederycho77/PortalAkademikGajahMada).

Panduan instalasi manual di bawah ini berasal dari repo sumber; untuk setup Docker gunakan panduan DevOps di atas.

Sistem Informasi Akademik berbasis web untuk SMA Gajah Mada Binjai.
Dibangun dengan Node.js + Express.js (backend), MySQL (database), dan HTML/CSS (frontend).

---

## Daftar Isi

1. [Fitur Sistem](#fitur-sistem)
2. [Tech Stack](#tech-stack)
3. [Struktur Folder](#struktur-folder)
4. [Prasyarat](#prasyarat)
5. [Panduan Instalasi](#panduan-instalasi)
6. [Menjalankan Aplikasi](#menjalankan-aplikasi)
7. [Akun Demo](#akun-demo)
8. [Peta Endpoint API](#peta-endpoint-api)
9. [Black Box Testing](#black-box-testing)

---

## Fitur Sistem

| Fitur | Admin | Guru | Siswa | Orang Tua |
|---|:---:|:---:|:---:|:---:|
| Login & manajemen sesi | ✅ | ✅ | ✅ | ✅ |
| Manajemen akun pengguna | ✅ | — | — | — |
| Input & edit nilai siswa | ✅ | ✅ | — | — |
| Lihat nilai | ✅ | ✅ | ✅ (milik sendiri) | ✅ (anak) |
| Input absensi (bulk) | ✅ | ✅ | — | — |
| Lihat rekap absensi | ✅ | ✅ | ✅ (milik sendiri) | ✅ (anak) |
| Buat pengumuman | ✅ | ✅ | — | — |
| Lihat pengumuman | ✅ | ✅ | ✅ | ✅ |
| Kelola ekstrakurikuler | ✅ | — | — | — |
| Daftar ekskul (+ cek kuota) | — | — | ✅ | — |
| Terima/tolak pendaftaran | ✅ | ✅ | — | — |

---

## Tech Stack

- **Runtime**: Node.js ≥ 18
- **Framework**: Express.js 4.x
- **Database**: MySQL 8.x
- **Auth**: JSON Web Token (JWT) + bcrypt
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (Fetch API)
- **Keamanan**: helmet, cors, express-rate-limit, express-validator

---

## Struktur Folder

```
PORTALAKADEMIK/
├── database/
│   ├── schema.sql          ← DDL: buat semua tabel & trigger
│   └── seed.js             ← Script isi data awal + akun demo
├── public/                 ← File statis (disajikan langsung oleh Express)
│   ├── index.html          ← Halaman login
│   ├── css/
│   │   ├── login.css
│   │   └── dashboard.css
│   ├── js/                 ← (opsional: JS terpisah)
│   ├── images/
│   └── pages/
│       └── dashboard-siswa.html
├── src/
│   ├── config/
│   │   └── db.js           ← Koneksi MySQL (connection pool)
│   ├── controllers/        ← Logika bisnis per fitur
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── nilai.controller.js
│   │   ├── absensi.controller.js
│   │   ├── pengumuman.controller.js
│   │   └── ekskul.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js      ← verifyToken (JWT)
│   │   ├── role.middleware.js      ← allowRoles, isSelf
│   │   └── validate.middleware.js  ← express-validator runner
│   ├── routes/             ← Definisi endpoint per fitur
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── nilai.routes.js
│   │   ├── absensi.routes.js
│   │   ├── pengumuman.routes.js
│   │   └── ekskul.routes.js
│   └── utils/
│       └── response.js     ← sendSuccess / sendError helper
├── uploads/                ← File yang diupload (tidak di-commit)
├── .env                    ← Konfigurasi environment (tidak di-commit)
├── .gitignore
├── package.json
├── README.md
└── server.js               ← Entry point
```

---

## Prasyarat

Pastikan sudah terinstal di komputer Anda:

| Software | Versi Minimum | Cek dengan |
|---|---|---|
| Node.js | 18.x | `node -v` |
| npm | 9.x | `npm -v` |
| MySQL Server | 8.0 | `mysql --version` |

---

## Panduan Instalasi

### Langkah 1 — Clone / Download proyek

```bash
# Masuk ke folder proyek
cd d:/Kiro_Project/PORTALAKADEMIK
```

### Langkah 2 — Install dependensi Node.js

```bash
npm install
```

Paket yang akan terinstal:
`express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `helmet`, `cors`,
`morgan`, `express-rate-limit`, `express-validator`, `multer`, `dotenv`

### Langkah 3 — Konfigurasi environment

Edit file `.env` dan sesuaikan nilainya:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password_mysql_anda   ← GANTI INI
DB_NAME=smas_gajah_mada

JWT_SECRET=ganti_dengan_string_acak_panjang  ← GANTI INI
JWT_EXPIRES_IN=8h

BCRYPT_SALT_ROUNDS=10
```

### Langkah 4 — Buat database dan tabel

Buka MySQL client (MySQL Workbench, HeidiSQL, DBeaver, atau terminal):

```sql
-- Opsi A: via terminal MySQL
mysql -u root -p < database/schema.sql

-- Opsi B: copy-paste isi file database/schema.sql ke MySQL client
```

Verifikasi tabel berhasil dibuat:

```sql
USE smas_gajah_mada;
SHOW TABLES;
-- Harus muncul 10 tabel
```

### Langkah 5 — Isi data awal (seed)

```bash
node database/seed.js
```

Output yang diharapkan:

```
🌱 Memulai seeding database...
📝 Membuat akun users...
   ✅ Users berhasil dibuat
📝 Membuat data kelas...
   ✅ Kelas berhasil dibuat
...
🎉 Seeding selesai!
┌─────────────────┬──────────────┬─────────────┐
│ Username        │ Password     │ Role        │
├─────────────────┼──────────────┼─────────────┤
│ admin_portal    │ Admin@1234   │ admin       │
│ guru_budi       │ Guru@1234    │ guru        │
│ guru_siti       │ Guru@5678    │ guru        │
│ siswa_rizky     │ Siswa@1234   │ siswa       │
│ siswa_dewi      │ Siswa@5678   │ siswa       │
│ siswa_fajar     │ Siswa@9012   │ siswa       │
│ ortu_ahmad      │ Ortu@1234    │ orang_tua   │
└─────────────────┴──────────────┴─────────────┘
```

---

## Menjalankan Aplikasi

```bash
# Mode development (auto-restart saat ada perubahan file)
npm run dev

# Mode production
npm start
```

Server berjalan di: **http://localhost:3000**

Output yang diharapkan di terminal:

```
✅  Database MySQL terhubung — Host: localhost | DB: smas_gajah_mada

🚀  Portal Akademik SMA Gajah Mada Binjai
📡  Server berjalan di   : http://localhost:3000
🌍  Mode                 : development
📋  API Base URL         : http://localhost:3000/api/v1
```

---

## Akun Demo

| Username | Password | Role | Akses |
|---|---|---|---|
| `admin_portal` | `Admin@1234` | Admin | Semua fitur |
| `guru_budi` | `Guru@1234` | Guru | Input nilai, absensi, pengumuman |
| `guru_siti` | `Guru@5678` | Guru | Input nilai, absensi, pengumuman |
| `siswa_rizky` | `Siswa@1234` | Siswa | Lihat nilai, absensi, daftar ekskul |
| `siswa_dewi` | `Siswa@5678` | Siswa | Lihat nilai, absensi, daftar ekskul |
| `siswa_fajar` | `Siswa@9012` | Siswa | Lihat nilai, absensi, daftar ekskul |
| `ortu_ahmad` | `Ortu@1234` | Orang Tua | Lihat data anak (Rizky) |

---

## Peta Endpoint API

Base URL: `http://localhost:3000/api/v1`

### Auth
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| POST | `/auth/login` | Public | Login, dapat JWT token |
| GET | `/auth/me` | Semua (token) | Info user yang login |
| POST | `/auth/change-password` | Semua (token) | Ganti password |

### Nilai
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| GET | `/nilai/siswa/:siswaId` | Semua | Lihat nilai siswa |
| POST | `/nilai` | Admin, Guru | Input nilai baru |
| PUT | `/nilai/:id` | Admin, Guru | Edit nilai |
| DELETE | `/nilai/:id` | Admin | Hapus nilai |

### Absensi
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| GET | `/absensi/siswa/:siswaId` | Semua | Lihat absensi siswa |
| GET | `/absensi/rekap-kelas/:kelasId` | Admin, Guru | Rekap absensi kelas |
| POST | `/absensi/bulk` | Admin, Guru | Input absensi massal |
| PUT | `/absensi/:id` | Admin, Guru | Koreksi absensi |

### Pengumuman
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| GET | `/pengumuman` | Semua | List pengumuman |
| GET | `/pengumuman/:id` | Semua | Detail pengumuman |
| POST | `/pengumuman` | Admin, Guru | Buat pengumuman |
| PUT | `/pengumuman/:id` | Admin, Guru (penulis) | Edit pengumuman |
| DELETE | `/pengumuman/:id` | Admin, Guru (penulis) | Hapus pengumuman |

### Ekstrakurikuler
| Method | Endpoint | Akses | Deskripsi |
|---|---|---|---|
| GET | `/ekskul` | Semua | List ekskul |
| GET | `/ekskul/:id` | Semua | Detail ekskul |
| POST | `/ekskul` | Admin | Buat ekskul baru |
| PUT | `/ekskul/:id` | Admin | Edit ekskul |
| DELETE | `/ekskul/:id` | Admin | Nonaktifkan ekskul |
| **POST** | **`/ekskul/daftar`** | **Siswa** | **Daftar ekskul (cek kuota!)** |
| GET | `/ekskul/pendaftaran/saya` | Siswa | Status pendaftaran saya |
| GET | `/ekskul/:id/peserta` | Admin, Guru | Daftar peserta |
| PATCH | `/ekskul/pendaftaran/:id/status` | Admin, Guru | Terima/tolak pendaftaran |
| DELETE | `/ekskul/pendaftaran/:id/batal` | Siswa | Batalkan pendaftaran |

---

## Black Box Testing

Panduan pengujian fungsional tanpa melihat kode internal.
Gunakan browser atau tool seperti **Postman** / **Thunder Client** (VS Code extension).

> **Persiapan**: Server harus sudah berjalan (`npm run dev`) dan database sudah di-seed.

---

### TC-001: Login Berhasil

**Tujuan**: Verifikasi login dengan kredensial yang benar.

**Langkah**:
1. Buka `http://localhost:3000`
2. Masukkan Username: `siswa_rizky`, Password: `Siswa@1234`
3. Klik tombol **Masuk**

**Hasil yang Diharapkan**:
- Tidak ada pesan error
- Browser redirect ke `/pages/dashboard-siswa.html`
- Dashboard menampilkan nama "Rizky Pratama"
- Sidebar menampilkan menu navigasi

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-002: Login Gagal — Password Salah

**Tujuan**: Verifikasi sistem menolak kredensial yang salah.

**Langkah**:
1. Buka `http://localhost:3000`
2. Masukkan Username: `siswa_rizky`, Password: `passwordSalah`
3. Klik tombol **Masuk**

**Hasil yang Diharapkan**:
- Muncul pesan error: *"Username atau password salah."*
- Halaman tidak berpindah
- Kolom password otomatis dikosongkan

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-003: Login Gagal — Field Kosong

**Tujuan**: Verifikasi validasi form sisi client.

**Langkah**:
1. Buka `http://localhost:3000`
2. Kosongkan semua field
3. Klik tombol **Masuk**

**Hasil yang Diharapkan**:
- Muncul pesan error di bawah field username: *"Username wajib diisi"*
- Muncul pesan error di bawah field password: *"Password wajib diisi"*
- Request tidak dikirim ke server

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-004: Redirect Role yang Benar

**Tujuan**: Verifikasi setiap role diarahkan ke dashboard yang sesuai.

**Langkah**:
1. Login sebagai `admin_portal` / `Admin@1234`
2. Perhatikan URL setelah redirect

**Hasil yang Diharapkan**:
- Redirect ke `/pages/dashboard-admin.html`

Ulangi untuk:
- `guru_budi` → `/pages/dashboard-guru.html`
- `siswa_rizky` → `/pages/dashboard-siswa.html`
- `ortu_ahmad` → `/pages/dashboard-ortu.html`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-005: Akses Tanpa Token (Via API)

**Tujuan**: Verifikasi endpoint terlindungi menolak request tanpa token.

**Langkah** (gunakan Postman):
```
GET http://localhost:3000/api/v1/pengumuman
Headers: (kosong — tidak ada Authorization)
```

**Hasil yang Diharapkan**:
```json
{
  "success": false,
  "message": "Akses ditolak. Token tidak ditemukan."
}
```
HTTP Status: `401 Unauthorized`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-006: Lihat Nilai Siswa

**Tujuan**: Verifikasi siswa dapat melihat nilai miliknya.

**Langkah**:
1. Login sebagai `siswa_rizky`
2. Klik menu **Nilai Saya** di sidebar

**Hasil yang Diharapkan**:
- Tabel nilai muncul dengan kolom: Mata Pelajaran, KKM, Nilai Harian, UTS, UAS, Nilai Akhir, Keterangan
- Data Matematika dan Bahasa Indonesia muncul (dari seed data)
- Badge "Tuntas" / "Belum Tuntas" muncul sesuai nilai
- Rata-rata ditampilkan di header halaman

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-007: Siswa Tidak Bisa Lihat Nilai Siswa Lain (Via API)

**Tujuan**: Verifikasi isolasi data antar siswa.

**Langkah** (gunakan Postman):
1. Login sebagai `siswa_dewi`, catat token-nya
2. Cari `siswa_profile.id` milik `siswa_rizky` (asumsikan id=1)
3. Kirim request:
```
GET http://localhost:3000/api/v1/nilai/siswa/1
Headers: Authorization: Bearer <token_siswa_dewi>
```

**Hasil yang Diharapkan**:
```json
{
  "success": false,
  "message": "Anda hanya bisa melihat nilai milik Anda sendiri."
}
```
HTTP Status: `403 Forbidden`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-008: Melihat Rekap Absensi

**Tujuan**: Verifikasi halaman absensi menampilkan data dengan benar.

**Langkah**:
1. Login sebagai `siswa_rizky`
2. Klik menu **Absensi** di sidebar

**Hasil yang Diharapkan**:
- 4 kotak ringkasan muncul: Hadir, Izin, Sakit, Alpa (dengan angka)
- Progress bar persentase kehadiran muncul
- Tabel riwayat absensi muncul (meskipun kosong, tabel tetap muncul)

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-009: Melihat Pengumuman

**Tujuan**: Verifikasi pengumuman tampil dan bisa dibuka detail-nya.

**Langkah**:
1. Login sebagai `siswa_rizky`
2. Klik menu **Pengumuman** di sidebar
3. Klik salah satu card pengumuman

**Hasil yang Diharapkan**:
- Daftar pengumuman muncul (minimal 2 dari seed data)
- Pengumuman yang disematkan (pinned) tampil dengan latar kuning
- Klik card → modal detail terbuka dengan isi lengkap
- Modal bisa ditutup dengan tombol ×

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-010: Pendaftaran Ekskul — Berhasil

**Tujuan**: Verifikasi alur pendaftaran ekskul berjalan normal.

**Langkah**:
1. Login sebagai `siswa_rizky`
2. Klik menu **Ekstrakurikuler**
3. Pilih ekskul yang masih ada kuota (misal: "English Club")
4. Klik tombol **+ Daftar Sekarang**
5. Klik **Daftar Sekarang** di modal konfirmasi

**Hasil yang Diharapkan**:
- Modal konfirmasi muncul dengan nama ekskul yang benar
- Setelah konfirmasi: muncul toast notifikasi hijau *"Pendaftaran berhasil dikirim"*
- Tombol pada ekskul tersebut berubah menjadi *"✅ Sudah Terdaftar"* (disabled)
- Klik menu **Pendaftaran Saya** → muncul baris pendaftaran dengan status **pending**

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-011: Pendaftaran Ekskul — Kuota Penuh

**Tujuan**: Verifikasi sistem menolak pendaftaran saat kuota habis.

**Langkah** (simulasi via Postman atau update langsung di DB):
1. Set kuota penuh: `UPDATE ekstrakurikuler SET kuota_terisi = kuota_max WHERE nama_ekskul = 'PMR';`
2. Login sebagai `siswa_fajar`
3. Coba daftar ekskul "PMR" via Postman:
```
POST http://localhost:3000/api/v1/ekskul/daftar
Headers: Authorization: Bearer <token_siswa_fajar>
Body: { "ekskul_id": 4 }
```

**Hasil yang Diharapkan**:
```json
{
  "success": false,
  "message": "Maaf, kuota untuk ekskul \"PMR\" sudah penuh (30/30 peserta)."
}
```
HTTP Status: `409 Conflict`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-012: Pendaftaran Ekskul — Daftar Dua Kali

**Tujuan**: Verifikasi sistem mencegah pendaftaran duplikat.

**Langkah**:
1. Login sebagai `siswa_rizky` (yang sudah daftar English Club di TC-010)
2. Coba daftar English Club lagi via Postman:
```
POST http://localhost:3000/api/v1/ekskul/daftar
Headers: Authorization: Bearer <token_siswa_rizky>
Body: { "ekskul_id": 5 }
```

**Hasil yang Diharapkan**:
```json
{
  "success": false,
  "message": "Anda sudah pernah mendaftar ekskul ini. Status pendaftaran: \"pending\"."
}
```
HTTP Status: `409 Conflict`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-013: Admin Terima Pendaftaran → Kuota Berkurang

**Tujuan**: Verifikasi trigger database menambah kuota_terisi saat pendaftaran diterima.

**Langkah**:
1. Catat `kuota_terisi` English Club sebelum (misal: 0)
2. Login sebagai `admin_portal`, dapatkan tokennya
3. Cari `pendaftaran_id` milik Rizky di English Club (lihat DB atau GET `/ekskul/5/peserta`)
4. Kirim:
```
PATCH http://localhost:3000/api/v1/ekskul/pendaftaran/1/status
Headers: Authorization: Bearer <token_admin>
Body: { "status": "diterima" }
```
5. Cek di DB: `SELECT kuota_terisi FROM ekstrakurikuler WHERE id = 5;`

**Hasil yang Diharapkan**:
- Response: `{ "success": true, "message": "Pendaftaran berhasil diterima" }`
- `kuota_terisi` bertambah 1 (dari 0 menjadi 1) — dikerjakan oleh trigger MySQL

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-014: Siswa Batal Pendaftaran

**Tujuan**: Verifikasi siswa bisa membatalkan pendaftaran yang masih pending.

**Langkah**:
1. Login sebagai `siswa_dewi`, daftar ke ekskul "Basket"
2. Klik menu **Pendaftaran Saya**
3. Klik tombol **Batalkan** pada baris Basket

**Hasil yang Diharapkan**:
- Toast notifikasi *"Pendaftaran berhasil dibatalkan"* muncul
- Baris Basket hilang dari tabel pendaftaran

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-015: Rate Limiter Login

**Tujuan**: Verifikasi proteksi brute-force pada endpoint login.

**Langkah** (gunakan Postman atau script):
1. Kirim request login dengan password salah sebanyak **11 kali berturut-turut** dalam 15 menit ke:
   `POST http://localhost:3000/api/v1/auth/login`

**Hasil yang Diharapkan**:
- Request ke-11 mendapat response:
```json
{
  "success": false,
  "message": "Terlalu banyak percobaan login. Coba lagi dalam 15 menit."
}
```
HTTP Status: `429 Too Many Requests`

**Status**: ⬜ Pass / ⬜ Fail

---

### TC-016: Responsivitas Tampilan (Mobile)

**Tujuan**: Verifikasi tampilan berfungsi di layar mobile.

**Langkah**:
1. Buka `http://localhost:3000` di browser
2. Buka DevTools → Toggle device toolbar (Ctrl+Shift+M)
3. Pilih ukuran layar 375px (iPhone SE)
4. Login dan buka dashboard

**Hasil yang Diharapkan**:
- Halaman login: form tampil di bawah branding (stacked layout)
- Dashboard: sidebar tersembunyi, tombol ☰ muncul di topbar
- Klik ☰ → sidebar muncul dari kiri dengan overlay gelap
- Stat cards tampil 2 kolom
- Tabel bisa di-scroll horizontal

**Status**: ⬜ Pass / ⬜ Fail

---

### Rekap Hasil Testing

| No | Test Case | Hasil |
|---|---|---|
| TC-001 | Login Berhasil | ⬜ Pass / ⬜ Fail |
| TC-002 | Login Gagal — Password Salah | ⬜ Pass / ⬜ Fail |
| TC-003 | Login Gagal — Field Kosong | ⬜ Pass / ⬜ Fail |
| TC-004 | Redirect Role yang Benar | ⬜ Pass / ⬜ Fail |
| TC-005 | Akses Tanpa Token | ⬜ Pass / ⬜ Fail |
| TC-006 | Lihat Nilai Siswa | ⬜ Pass / ⬜ Fail |
| TC-007 | Isolasi Data Nilai Antar Siswa | ⬜ Pass / ⬜ Fail |
| TC-008 | Rekap Absensi | ⬜ Pass / ⬜ Fail |
| TC-009 | Melihat Pengumuman | ⬜ Pass / ⬜ Fail |
| TC-010 | Daftar Ekskul — Berhasil | ⬜ Pass / ⬜ Fail |
| TC-011 | Daftar Ekskul — Kuota Penuh | ⬜ Pass / ⬜ Fail |
| TC-012 | Daftar Ekskul — Duplikat | ⬜ Pass / ⬜ Fail |
| TC-013 | Admin Terima → Kuota Berkurang | ⬜ Pass / ⬜ Fail |
| TC-014 | Siswa Batal Pendaftaran | ⬜ Pass / ⬜ Fail |
| TC-015 | Rate Limiter Login | ⬜ Pass / ⬜ Fail |
| TC-016 | Responsivitas Mobile | ⬜ Pass / ⬜ Fail |

---

## Lisensi

Proyek ini dibuat untuk keperluan akademik SMA Gajah Mada Binjai.
