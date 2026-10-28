/**
 * server.js
 * ---------------------------------------------------------------
 * Entry point utama aplikasi Portal Akademik SMA Gajah Mada.
 * Tugas file ini:
 *   1. Load environment variables
 *   2. Inisialisasi Express dan middleware global
 *   3. Mount semua route API
 *   4. Sajikan file statis (frontend HTML/CSS/JS)
 *   5. Global error handler
 *   6. Start server
 * ---------------------------------------------------------------
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const rateLimit  = require('express-rate-limit');

const { pool, testConnection } = require('./src/config/db');
const { sendError }      = require('./src/utils/response');

// --- Import semua Router ---
const authRoutes      = require('./src/routes/auth.routes');
const userRoutes      = require('./src/routes/user.routes');
const nilaiRoutes     = require('./src/routes/nilai.routes');
const absensiRoutes   = require('./src/routes/absensi.routes');
const pengumumanRoutes = require('./src/routes/pengumuman.routes');
const ekskulRoutes    = require('./src/routes/ekskul.routes');
const beritaRoutes    = require('./src/routes/berita.routes');

// ---------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 3000;
const serveFrontend = process.env.SERVE_FRONTEND !== 'false';
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));

// Readiness verifies the application schema, not only the HTTP listener.
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT id FROM users LIMIT 1');
    await pool.query('SELECT id FROM berita LIMIT 1');
    res.json({ status: 'ok', database: 'connected', features: ['berita'] });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'unavailable' });
  }
});

// ---------------------------------------------------------------
// MIDDLEWARE GLOBAL
// ---------------------------------------------------------------

// Keamanan HTTP header
app.use(helmet({
  // Izinkan inline script pada halaman HTML statis kita
  contentSecurityPolicy: false,
}));

// Logging request di terminal (mode 'dev' = ringkas & berwarna)
app.use(morgan('dev'));

// CORS — izinkan semua origin saat development
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://smagm.sch.id']          // ganti dengan domain produksi
    : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON body
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded body (form HTML biasa)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter global — cegah brute-force / spam
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 menit
  max: 200,                   // max 200 request per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan. Coba lagi nanti.' },
});
app.use('/api/', globalLimiter);

// Rate limiter khusus login — lebih ketat
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
});
app.use('/api/v1/auth/login', loginLimiter);

// ---------------------------------------------------------------
// SAJIKAN FILE STATIS (Frontend HTML/CSS/JS)
// ---------------------------------------------------------------
if (serveFrontend) app.use(express.static(path.join(__dirname, 'public')));

// Folder uploads bisa diakses publik (foto profil, lampiran)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------------------------------------------------------------
// ROUTING API  — prefix: /api/v1
// ---------------------------------------------------------------
const API = '/api/v1';

app.use(`${API}/auth`,       authRoutes);       // Login, logout, refresh token
app.use(`${API}/users`,      userRoutes);       // Manajemen user (admin)
app.use(`${API}/nilai`,      nilaiRoutes);      // Input/lihat nilai siswa
app.use(`${API}/absensi`,    absensiRoutes);    // Input/lihat absensi
app.use(`${API}/pengumuman`, pengumumanRoutes); // CRUD pengumuman sekolah
app.use(`${API}/ekskul`,     ekskulRoutes);     // Ekskul + pendaftaran
app.use(`${API}/berita`,     beritaRoutes);     // Berita sekolah

// ---------------------------------------------------------------
// ROUTE CATCH-ALL — Kembalikan index.html untuk SPA (Single Page)
// ---------------------------------------------------------------
app.get('*', (req, res) => {
  // Hanya untuk request non-API
  if (serveFrontend && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  // Jika URL API tidak ditemukan
  return sendError(res, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
});

// ---------------------------------------------------------------
// GLOBAL ERROR HANDLER
// Menangkap error yang dilempar dengan next(err) dari middleware
// ---------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('💥 Unhandled Error:', err);

  // Error dari multer (upload file)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, `Ukuran file melebihi batas maksimum (${process.env.MAX_FILE_SIZE_MB || 5}MB)`, 413);
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, 'Token tidak valid atau sudah kedaluwarsa', 401);
  }

  // Error MySQL duplikat entry (unique constraint violation)
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'Data sudah ada. Periksa kembali inputan Anda.', 409);
  }

  const statusCode = err.statusCode || 500;
  const message    = statusCode === 500 ? 'Terjadi kesalahan internal server' : err.message;
  return sendError(res, message, statusCode);
});

// ---------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------
async function startServer() {
  // 1. Test koneksi database dulu sebelum menerima request
  await testConnection();
  await require('./database/migrate').runMigrations();

  // 2. Baru start HTTP server
  app.listen(PORT, () => {
    console.log('');
    console.log('🚀  Portal Akademik SMA Gajah Mada Binjai');
    console.log(`📡  Server berjalan di   : http://localhost:${PORT}`);
    console.log(`🌍  Mode                 : ${process.env.NODE_ENV || 'development'}`);
    console.log(`📋  API Base URL         : http://localhost:${PORT}/api/v1`);
    console.log('');
  });
}

startServer();
