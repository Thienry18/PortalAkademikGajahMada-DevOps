'use strict';
const { pool } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

const fields = `b.id, b.judul, b.ringkasan, b.penulis_id, b.created_at, b.updated_at,
  u.nama_lengkap AS nama_penulis`;

const listBerita = async (req, res, next) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 9);
  const search = req.query.search || '';
  const where = search ? 'WHERE b.judul LIKE ? OR b.ringkasan LIKE ? OR b.isi LIKE ?' : '';
  const params = search ? Array(3).fill(`%${search}%`) : [];
  try {
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM berita b ${where}`, params);
    const [rows] = await pool.query(
      `SELECT ${fields} FROM berita b JOIN users u ON u.id = b.penulis_id ${where}
       ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );
    return sendSuccess(res, { berita: rows, page, limit, total: Number(total), total_pages: Math.ceil(Number(total) / limit) });
  } catch (error) { next(error); }
};

const getBerita = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT ${fields}, b.isi FROM berita b JOIN users u ON u.id = b.penulis_id WHERE b.id = ?`, [req.params.id]
    );
    if (!row) return sendError(res, 'Berita tidak ditemukan.', 404);
    return sendSuccess(res, row);
  } catch (error) { next(error); }
};

const createBerita = async (req, res, next) => {
  try {
    const { judul, isi, ringkasan = '' } = req.body;
    const [result] = await pool.query(
      'INSERT INTO berita (judul, ringkasan, isi, penulis_id) VALUES (?, ?, ?, ?)',
      [judul, ringkasan, isi, req.user.id]
    );
    return sendSuccess(res, { id: result.insertId }, 'Berita berhasil diterbitkan.', 201);
  } catch (error) { next(error); }
};

async function ownsBerita(req, res) {
  const [[existing]] = await pool.query('SELECT penulis_id FROM berita WHERE id = ?', [req.params.id]);
  if (!existing) { sendError(res, 'Berita tidak ditemukan.', 404); return false; }
  if (req.user.role !== 'admin' && Number(existing.penulis_id) !== Number(req.user.id)) {
    sendError(res, 'Anda hanya dapat mengelola berita yang Anda tulis.', 403);
    return false;
  }
  return true;
}

const updateBerita = async (req, res, next) => {
  try {
    if (!await ownsBerita(req, res)) return;
    const { judul, isi, ringkasan = '' } = req.body;
    await pool.query('UPDATE berita SET judul = ?, ringkasan = ?, isi = ? WHERE id = ?',
      [judul, ringkasan, isi, req.params.id]);
    return sendSuccess(res, null, 'Berita berhasil diperbarui.');
  } catch (error) { next(error); }
};

const deleteBerita = async (req, res, next) => {
  try {
    if (!await ownsBerita(req, res)) return;
    await pool.query('DELETE FROM berita WHERE id = ?', [req.params.id]);
    return sendSuccess(res, null, 'Berita berhasil dihapus.');
  } catch (error) { next(error); }
};

module.exports = { listBerita, getBerita, createBerita, updateBerita, deleteBerita };
