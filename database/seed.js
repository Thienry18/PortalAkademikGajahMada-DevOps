/**
 * database/seed.js
 * ---------------------------------------------------------------
 * Script untuk mengisi data awal (seed) ke database.
 * Jalankan dengan: node database/seed.js
 *
 * Yang akan dibuat:
 *   - 1 akun admin
 *   - 2 akun guru
 *   - 3 akun siswa + profil + kelas
 *   - 1 akun orang tua (terhubung ke siswa pertama)
 * ---------------------------------------------------------------
 */

'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/db');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

async function seed() {
  console.log('🌱 Memulai seeding database...\n');

  try {
    // ── 1. Hash semua password ────────────────────────────────
    const [
      hashAdmin, hashGuru1, hashGuru2,
      hashSiswa1, hashSiswa2, hashSiswa3,
      hashOrtu
    ] = await Promise.all([
      bcrypt.hash('Admin@1234',    SALT_ROUNDS),
      bcrypt.hash('Guru@1234',     SALT_ROUNDS),
      bcrypt.hash('Guru@5678',     SALT_ROUNDS),
      bcrypt.hash('Siswa@1234',    SALT_ROUNDS),
      bcrypt.hash('Siswa@5678',    SALT_ROUNDS),
      bcrypt.hash('Siswa@9012',    SALT_ROUNDS),
      bcrypt.hash('Ortu@1234',     SALT_ROUNDS),
    ]);

    // ── 2. Insert Users ───────────────────────────────────────
    console.log('📝 Membuat akun users...');
    const [adminResult] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'admin', 'Administrator Portal', 'admin@smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['admin_portal', hashAdmin]
    );

    const [[adminUser]] = await pool.query("SELECT id FROM users WHERE username = 'admin_portal'");

    const [guru1Result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'guru', 'Budi Santoso, S.Pd', 'budi.santoso@smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['guru_budi', hashGuru1]
    );
    const [[guru1User]] = await pool.query("SELECT id FROM users WHERE username = 'guru_budi'");

    const [guru2Result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'guru', 'Siti Rahayu, S.Pd', 'siti.rahayu@smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['guru_siti', hashGuru2]
    );
    const [[guru2User]] = await pool.query("SELECT id FROM users WHERE username = 'guru_siti'");

    const [ortuResult] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email, no_hp)
       VALUES (?, ?, 'orang_tua', 'Ahmad Wijaya', 'ahmad.wijaya@gmail.com', '081234567890')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['ortu_ahmad', hashOrtu]
    );
    const [[ortuUser]] = await pool.query("SELECT id FROM users WHERE username = 'ortu_ahmad'");

    const [siswa1Result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'siswa', 'Rizky Pratama', 'rizky.p@student.smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['siswa_rizky', hashSiswa1]
    );
    const [[siswa1User]] = await pool.query("SELECT id FROM users WHERE username = 'siswa_rizky'");

    const [siswa2Result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'siswa', 'Dewi Lestari', 'dewi.l@student.smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['siswa_dewi', hashSiswa2]
    );
    const [[siswa2User]] = await pool.query("SELECT id FROM users WHERE username = 'siswa_dewi'");

    const [siswa3Result] = await pool.query(
      `INSERT INTO users (username, password, role, nama_lengkap, email)
       VALUES (?, ?, 'siswa', 'Fajar Nugroho', 'fajar.n@student.smagm.sch.id')
       ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      ['siswa_fajar', hashSiswa3]
    );
    const [[siswa3User]] = await pool.query("SELECT id FROM users WHERE username = 'siswa_fajar'");

    console.log('   ✅ Users berhasil dibuat');

    // ── 3. Insert Kelas ───────────────────────────────────────
    console.log('📝 Membuat data kelas...');
    await pool.query(
      `INSERT INTO kelas (nama_kelas, tingkat, jurusan, tahun_ajaran, wali_kelas_id)
       VALUES
         ('X IPA 1',   10, 'IPA', '2025/2026', ?),
         ('X IPS 1',   10, 'IPS', '2025/2026', ?),
         ('XI IPA 1',  11, 'IPA', '2025/2026', ?)
       ON DUPLICATE KEY UPDATE wali_kelas_id = VALUES(wali_kelas_id)`,
      [guru1User.id, guru2User.id, guru1User.id]
    );
    const [[kelas1]] = await pool.query("SELECT id FROM kelas WHERE nama_kelas = 'X IPA 1'");
    console.log('   ✅ Kelas berhasil dibuat');

    // ── 4. Insert Profil Guru ─────────────────────────────────
    console.log('📝 Membuat profil guru...');
    await pool.query(
      `INSERT INTO guru_profile (user_id, nip, mata_pelajaran, jenis_kelamin)
       VALUES (?, '198501012010011001', 'Matematika', 'L')
       ON DUPLICATE KEY UPDATE nip = VALUES(nip)`,
      [guru1User.id]
    );
    await pool.query(
      `INSERT INTO guru_profile (user_id, nip, mata_pelajaran, jenis_kelamin)
       VALUES (?, '199003152012012002', 'Bahasa Indonesia', 'P')
       ON DUPLICATE KEY UPDATE nip = VALUES(nip)`,
      [guru2User.id]
    );
    const [[guruProfile1]] = await pool.query("SELECT id FROM guru_profile WHERE user_id = ?", [guru1User.id]);
    console.log('   ✅ Profil guru berhasil dibuat');

    // ── 5. Insert Profil Siswa ────────────────────────────────
    console.log('📝 Membuat profil siswa...');
    await pool.query(
      `INSERT INTO siswa_profile (user_id, kelas_id, nis, nisn, jenis_kelamin, tanggal_lahir, orang_tua_id)
       VALUES (?, ?, '20250001', '0051234567', 'L', '2008-05-15', ?)
       ON DUPLICATE KEY UPDATE kelas_id = VALUES(kelas_id)`,
      [siswa1User.id, kelas1.id, ortuUser.id]
    );
    await pool.query(
      `INSERT INTO siswa_profile (user_id, kelas_id, nis, nisn, jenis_kelamin, tanggal_lahir)
       VALUES (?, ?, '20250002', '0051234568', 'P', '2008-08-22')
       ON DUPLICATE KEY UPDATE kelas_id = VALUES(kelas_id)`,
      [siswa2User.id, kelas1.id]
    );
    await pool.query(
      `INSERT INTO siswa_profile (user_id, kelas_id, nis, nisn, jenis_kelamin, tanggal_lahir)
       VALUES (?, ?, '20250003', '0051234569', 'L', '2008-11-03')
       ON DUPLICATE KEY UPDATE kelas_id = VALUES(kelas_id)`,
      [siswa3User.id, kelas1.id]
    );
    const [[siswaProfile1]] = await pool.query("SELECT id FROM siswa_profile WHERE user_id = ?", [siswa1User.id]);
    const [[mapelMtk]] = await pool.query("SELECT id FROM mata_pelajaran WHERE kode_mapel = 'MTK'");
    const [[mapelBin]] = await pool.query("SELECT id FROM mata_pelajaran WHERE kode_mapel = 'BIN'");
    console.log('   ✅ Profil siswa berhasil dibuat');

    // ── 6. Insert Contoh Nilai ────────────────────────────────
    console.log('📝 Membuat contoh data nilai...');
    await pool.query(
      `INSERT INTO nilai_siswa
         (siswa_id, mapel_id, kelas_id, guru_id, semester, tahun_ajaran, nilai_harian, nilai_uts, nilai_uas)
       VALUES
         (?, ?, ?, ?, 1, '2025/2026', 85.00, 80.00, 88.00),
         (?, ?, ?, ?, 1, '2025/2026', 78.00, 75.00, 82.00)
       ON DUPLICATE KEY UPDATE nilai_harian = VALUES(nilai_harian)`,
      [
        siswaProfile1.id, mapelMtk.id, kelas1.id, guruProfile1.id,
        siswaProfile1.id, mapelBin.id, kelas1.id, guruProfile1.id,
      ]
    );
    console.log('   ✅ Data nilai berhasil dibuat');

    // ── 7. Insert Pengumuman Contoh ───────────────────────────
    console.log('📝 Membuat contoh pengumuman...');
    await pool.query(
      `INSERT INTO pengumuman_sekolah (judul, isi, penulis_id, is_pinned, tanggal_tayang)
       VALUES
         ('Selamat Datang di Portal Akademik',
          'Kami dengan bangga mempersembahkan Portal Akademik SMA Gajah Mada Binjai. Silakan manfaatkan seluruh fitur yang tersedia.',
          ?, 1, CURDATE()),
         ('Jadwal Ujian Tengah Semester Ganjil 2025/2026',
          'UTS akan dilaksanakan pada tanggal 15-19 Oktober 2025. Harap mempersiapkan diri dengan baik.',
          ?, 0, CURDATE())`,
      [adminUser.id, adminUser.id]
    );
    console.log('   ✅ Pengumuman berhasil dibuat');

    console.log('\n🎉 Seeding selesai! Akun yang tersedia:');
    console.log('┌─────────────────┬──────────────┬─────────────┐');
    console.log('│ Username        │ Password     │ Role        │');
    console.log('├─────────────────┼──────────────┼─────────────┤');
    console.log('│ admin_portal    │ Admin@1234   │ admin       │');
    console.log('│ guru_budi       │ Guru@1234    │ guru        │');
    console.log('│ guru_siti       │ Guru@5678    │ guru        │');
    console.log('│ siswa_rizky     │ Siswa@1234   │ siswa       │');
    console.log('│ siswa_dewi      │ Siswa@5678   │ siswa       │');
    console.log('│ siswa_fajar     │ Siswa@9012   │ siswa       │');
    console.log('│ ortu_ahmad      │ Ortu@1234    │ orang_tua   │');
    console.log('└─────────────────┴──────────────┴─────────────┘');

  } catch (err) {
    console.error('\n❌ Seeding gagal:', err.message);
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
