/**
 * Загрузка файлов (логотипы) через Multer
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const auth = require('../middleware/auth');

const router = express.Router();

// Хранилище на диске: uploads/logos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'logos');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = (file.originalname || '').split('.').pop();
    const safeExt = ext && ext.length <= 10 ? ext : 'png';
    const name = `logo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /(png|jpg|jpeg|gif|webp)$/i.test(file.originalname || '') && /^image\//i.test(file.mimetype || '');
    if (!ok) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// POST /api/uploads/logo  (form field: logo)
router.post('/logo', auth.requireAuth, auth.requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Файл не получен' });
    const rel = path.posix.join('uploads', 'logos', path.basename(req.file.filename));
    const urlPath = `/uploads/logos/${path.basename(req.file.filename)}`;
    return res.json({ success: true, data: { path: rel, url: urlPath } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


