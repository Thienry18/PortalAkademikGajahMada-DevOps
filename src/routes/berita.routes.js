'use strict';
const { Router } = require('express');
const { body, param, query } = require('express-validator');
const controller = require('../controllers/berita.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const router = Router();
const id = () => param('id').isInt({ min: 1, max: 4294967295 }).withMessage('ID berita tidak valid.');
const content = () => [
  body('judul').isString().bail().trim().isLength({ min: 5, max: 200 }).withMessage('Judul harus 5–200 karakter.'),
  body('ringkasan').optional().isString().bail().trim().isLength({ max: 300 }).withMessage('Ringkasan maksimal 300 karakter.'),
  body('isi').isString().bail().trim().isLength({ min: 10, max: 50000 }).withMessage('Isi berita harus 10–50000 karakter.'),
];
router.use(verifyToken);
router.get('/', [
  query('page').optional().isInt({ min: 1, max: 1000000 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().isString().bail().trim().isLength({ max: 200 }),
], validate, controller.listBerita);
router.get('/:id', id(), validate, controller.getBerita);
router.post('/', allowRoles('admin', 'guru'), content(), validate, controller.createBerita);
router.put('/:id', allowRoles('admin', 'guru'), id(), content(), validate, controller.updateBerita);
router.delete('/:id', allowRoles('admin', 'guru'), id(), validate, controller.deleteBerita);
module.exports = router;
