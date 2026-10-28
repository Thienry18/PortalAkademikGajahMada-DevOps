-- ============================================================
--  PORTAL AKADEMIK SMA GAJAH MADA BINJAI
--  File   : schema.sql
--  Deskripsi : DDL untuk membuat seluruh tabel database
--  Engine    : MySQL 8.x
-- ============================================================

-- Buat dan gunakan database
CREATE DATABASE IF NOT EXISTS smas_gajah_mada
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE smas_gajah_mada;

-- ------------------------------------------------------------
-- TABEL 1: users
--   Menyimpan akun login semua pengguna.
--   role: 'admin' | 'guru' | 'siswa' | 'orang_tua'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)     NOT NULL UNIQUE,
    password    VARCHAR(255)    NOT NULL,           -- bcrypt hash
    role        ENUM('admin','guru','siswa','orang_tua') NOT NULL,
    nama_lengkap VARCHAR(100)   NOT NULL,
    email       VARCHAR(100)    UNIQUE,
    no_hp       VARCHAR(20),
    foto_profil VARCHAR(255)    DEFAULT NULL,
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 2: kelas
--   Master data kelas (misal: X-IPA-1, XI-IPS-2, dst.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kelas (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    nama_kelas  VARCHAR(30)     NOT NULL UNIQUE,   -- contoh: "X IPA 1"
    tingkat     TINYINT         NOT NULL,           -- 10, 11, atau 12
    jurusan     VARCHAR(30)     NOT NULL,           -- IPA / IPS / Bahasa
    tahun_ajaran VARCHAR(9)     NOT NULL,           -- contoh: "2025/2026"
    wali_kelas_id INT UNSIGNED  DEFAULT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wali_kelas_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 3: siswa_profile
--   Data detail siswa, terhubung ke users.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS siswa_profile (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED    NOT NULL UNIQUE,
    kelas_id    INT UNSIGNED    NOT NULL,
    nis         VARCHAR(20)     NOT NULL UNIQUE,    -- Nomor Induk Siswa
    nisn        VARCHAR(20)     UNIQUE,             -- Nomor Induk Siswa Nasional
    jenis_kelamin ENUM('L','P') NOT NULL,
    tanggal_lahir DATE          NOT NULL,
    alamat      TEXT,
    orang_tua_id INT UNSIGNED   DEFAULT NULL,       -- FK ke users (role orang_tua)
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (kelas_id)      REFERENCES kelas(id) ON DELETE RESTRICT,
    FOREIGN KEY (orang_tua_id)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 4: guru_profile
--   Data detail guru, terhubung ke users.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guru_profile (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED    NOT NULL UNIQUE,
    nip         VARCHAR(25)     NOT NULL UNIQUE,
    mata_pelajaran VARCHAR(50)  NOT NULL,
    jenis_kelamin ENUM('L','P') NOT NULL,
    tanggal_lahir DATE,
    alamat      TEXT,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 5: mata_pelajaran
--   Master data mata pelajaran.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mata_pelajaran (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    kode_mapel  VARCHAR(10)     NOT NULL UNIQUE,
    nama_mapel  VARCHAR(100)    NOT NULL,
    kkm         TINYINT UNSIGNED NOT NULL DEFAULT 75  -- Kriteria Ketuntasan Minimal
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 6: nilai_siswa
--   Menyimpan nilai akademik siswa per mata pelajaran per semester.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nilai_siswa (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    siswa_id        INT UNSIGNED    NOT NULL,       -- FK ke siswa_profile
    mapel_id        INT UNSIGNED    NOT NULL,       -- FK ke mata_pelajaran
    kelas_id        INT UNSIGNED    NOT NULL,
    guru_id         INT UNSIGNED    NOT NULL,       -- FK ke guru_profile (pengampu)
    semester        TINYINT         NOT NULL,       -- 1 atau 2
    tahun_ajaran    VARCHAR(9)      NOT NULL,
    nilai_harian    DECIMAL(5,2)    DEFAULT NULL,   -- Nilai Tes Harian
    nilai_uts       DECIMAL(5,2)    DEFAULT NULL,   -- Nilai Ujian Tengah Semester
    nilai_uas       DECIMAL(5,2)    DEFAULT NULL,   -- Nilai Ujian Akhir Semester
    nilai_akhir     DECIMAL(5,2)    GENERATED ALWAYS AS (
                        ROUND((nilai_harian * 0.30) + (nilai_uts * 0.30) + (nilai_uas * 0.40), 2)
                    ) STORED,                       -- Dihitung otomatis oleh DB
    keterangan      ENUM('Tuntas','Belum Tuntas') GENERATED ALWAYS AS (
                        IF(nilai_akhir >= 75, 'Tuntas', 'Belum Tuntas')
                    ) STORED,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_nilai (siswa_id, mapel_id, semester, tahun_ajaran),
    FOREIGN KEY (siswa_id)  REFERENCES siswa_profile(id) ON DELETE CASCADE,
    FOREIGN KEY (mapel_id)  REFERENCES mata_pelajaran(id) ON DELETE RESTRICT,
    FOREIGN KEY (kelas_id)  REFERENCES kelas(id) ON DELETE RESTRICT,
    FOREIGN KEY (guru_id)   REFERENCES guru_profile(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 7: absensi
--   Rekaman kehadiran siswa per hari per mata pelajaran.
--   status: 'H' = Hadir, 'I' = Izin, 'S' = Sakit, 'A' = Alpa
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS absensi (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    siswa_id    INT UNSIGNED    NOT NULL,
    kelas_id    INT UNSIGNED    NOT NULL,
    mapel_id    INT UNSIGNED    DEFAULT NULL,       -- NULL jika absensi harian umum
    guru_id     INT UNSIGNED    NOT NULL,           -- Guru yang mencatat
    tanggal     DATE            NOT NULL,
    status      ENUM('H','I','S','A') NOT NULL DEFAULT 'H',
    keterangan  VARCHAR(255)    DEFAULT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_absensi (siswa_id, mapel_id, tanggal),
    FOREIGN KEY (siswa_id)  REFERENCES siswa_profile(id) ON DELETE CASCADE,
    FOREIGN KEY (kelas_id)  REFERENCES kelas(id) ON DELETE RESTRICT,
    FOREIGN KEY (mapel_id)  REFERENCES mata_pelajaran(id) ON DELETE SET NULL,
    FOREIGN KEY (guru_id)   REFERENCES guru_profile(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 8: pengumuman_sekolah
--   Papan informasi / pengumuman yang dapat dibuat oleh admin/guru.
--   target_role: NULL berarti untuk semua pengguna.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pengumuman_sekolah (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    judul       VARCHAR(200)    NOT NULL,
    isi         TEXT            NOT NULL,
    penulis_id  INT UNSIGNED    NOT NULL,           -- FK ke users
    target_role SET('admin','guru','siswa','orang_tua') DEFAULT NULL,
    is_pinned   TINYINT(1)      NOT NULL DEFAULT 0, -- 1 = disematkan di atas
    tanggal_tayang DATE         NOT NULL DEFAULT (CURRENT_DATE),
    tanggal_expired DATE        DEFAULT NULL,       -- NULL = tidak ada expired
    lampiran    VARCHAR(255)    DEFAULT NULL,       -- path file lampiran
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (penulis_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 9: ekstrakurikuler
--   Data kegiatan ekstrakurikuler beserta kuota pendaftaran.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ekstrakurikuler (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    nama_ekskul     VARCHAR(100)    NOT NULL,
    deskripsi       TEXT,
    pembina_id      INT UNSIGNED    DEFAULT NULL,   -- FK ke users (guru)
    jadwal          VARCHAR(100)    NOT NULL,       -- contoh: "Senin, 15.00 - 17.00"
    tempat          VARCHAR(100),
    kuota_max       SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    kuota_terisi    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    biaya           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
    foto            VARCHAR(255)    DEFAULT NULL,
    is_active       TINYINT(1)      NOT NULL DEFAULT 1,
    created_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (pembina_id) REFERENCES users(id) ON DELETE SET NULL,
    -- Constraint: kuota_terisi tidak boleh melebihi kuota_max
    CONSTRAINT chk_kuota CHECK (kuota_terisi <= kuota_max)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TABEL 10: pendaftaran_ekskul
--   Rekaman pendaftaran siswa ke ekstrakurikuler.
--   status: 'pending' | 'diterima' | 'ditolak'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pendaftaran_ekskul (
    id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    siswa_id        INT UNSIGNED    NOT NULL,
    ekskul_id       INT UNSIGNED    NOT NULL,
    tanggal_daftar  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    status          ENUM('pending','diterima','ditolak') NOT NULL DEFAULT 'pending',
    alasan_penolakan VARCHAR(255)   DEFAULT NULL,
    -- Satu siswa hanya bisa mendaftar ke satu ekskul yang sama sekali
    UNIQUE KEY uq_daftar (siswa_id, ekskul_id),
    FOREIGN KEY (siswa_id)  REFERENCES siswa_profile(id) ON DELETE CASCADE,
    FOREIGN KEY (ekskul_id) REFERENCES ekstrakurikuler(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TRIGGER: Otomatis update kuota_terisi saat pendaftaran
--   diterima atau dibatalkan
-- ============================================================

DELIMITER //

-- Tambah kuota_terisi saat status berubah jadi 'diterima'
CREATE TRIGGER trg_ekskul_kuota_tambah
AFTER UPDATE ON pendaftaran_ekskul
FOR EACH ROW
BEGIN
    IF NEW.status = 'diterima' AND OLD.status != 'diterima' THEN
        UPDATE ekstrakurikuler
        SET kuota_terisi = kuota_terisi + 1
        WHERE id = NEW.ekskul_id;
    END IF;

    -- Kurangi kuota_terisi jika status berubah DARI 'diterima'
    IF OLD.status = 'diterima' AND NEW.status != 'diterima' THEN
        UPDATE ekstrakurikuler
        SET kuota_terisi = GREATEST(kuota_terisi - 1, 0)
        WHERE id = NEW.ekskul_id;
    END IF;
END//

DELIMITER ;

-- ============================================================
-- DATA AWAL (SEED DATA) — untuk keperluan testing
-- ============================================================

-- Akun demo dibuat oleh seed.js dengan bcrypt asli pada startup pertama.

-- Master Mata Pelajaran
INSERT INTO mata_pelajaran (kode_mapel, nama_mapel, kkm) VALUES
('MTK',     'Matematika',                   75),
('BIN',     'Bahasa Indonesia',             75),
('BING',    'Bahasa Inggris',               75),
('FIS',     'Fisika',                       72),
('KIM',     'Kimia',                        72),
('BIO',     'Biologi',                      72),
('SEJ',     'Sejarah Indonesia',            75),
('PKN',     'Pendidikan Kewarganegaraan',   75),
('PENJAS',  'Pendidikan Jasmani',           75),
('TIK',     'Teknologi Informasi',          78);

-- Master Ekstrakurikuler
INSERT INTO ekstrakurikuler (nama_ekskul, deskripsi, jadwal, tempat, kuota_max, biaya) VALUES
('Pramuka',         'Kegiatan kepanduan wajib untuk siswa kelas X',  'Jumat, 14.00 - 17.00',  'Lapangan Utama', 60, 0),
('Paduan Suara',    'Kelompok vokal dan musik sekolah',               'Rabu, 15.00 - 17.00',  'Aula',           25, 0),
('Basket',          'Tim basket putra dan putri sekolah',             'Selasa & Kamis, 15.30', 'Lap. Basket',    20, 0),
('PMR',             'Palang Merah Remaja',                            'Sabtu, 08.00 - 11.00', 'Ruang PMR',      30, 0),
('English Club',    'Klub percakapan dan debat Bahasa Inggris',       'Senin, 15.00 - 17.00', 'Lab. Bahasa',    20, 0),
('Robotika',        'Perakitan dan pemrograman robot sederhana',      'Rabu, 14.00 - 17.00',  'Lab. Komputer',  15, 50000),
('Volly Ball',      'Tim voli putra dan putri',                       'Senin & Rabu, 15.30',   'Lap. Voli',      24, 0),
('Jurnalistik',     'Majalah dinding dan penulisan kreatif',          'Kamis, 15.00 - 17.00', 'Ruang OSIS',     20, 0);
