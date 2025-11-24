/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

/**
 * Загрузка файлов (логотипы) через Multer
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
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
    const fullUrl = `http://localhost:8000${urlPath}`;
    return res.json({ success: true, data: { path: rel, url: fullUrl } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Хранилище для медиа-файлов контента в памяти (для сохранения в БД)
// Ограничение по размеру не установлено - база данных масштабируется
const mediaUpload = multer({
  storage: multer.memoryStorage(), // Храним в памяти для сохранения в БД
  // limits: { fileSize: ... } - убрано, нет ограничений по размеру
  fileFilter: (req, file, cb) => {
    // Разрешаем изображения и видео
    const isImage = /^image\/(png|jpg|jpeg|gif|webp|svg)$/i.test(file.mimetype || '');
    const isVideo = /^video\/(mp4|webm|ogg|mov|avi)$/i.test(file.mimetype || '');
    if (!isImage && !isVideo) {
      return cb(new Error('Разрешены только изображения (PNG, JPG, GIF, WEBP, SVG) и видео (MP4, WEBM, OGG, MOV, AVI)'));
    }
    cb(null, true);
  }
});

// POST /api/uploads/media  (form field: media) - для загрузки изображений и видео для контента
// Используем те же права, что и для создания страниц (требуется аутентификация и права редактора/админа)
router.post('/media', auth.requireAuth, async (req, res) => {
  // Проверяем права доступа (редактор или админ)
  if (!req.session.address) {
    return res.status(403).json({ success: false, message: 'Требуется подключение кошелька' });
  }
  
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ success: false, message: 'Требуются права редактора или админа' });
  }
  
  // Используем middleware для загрузки файла
  mediaUpload.single('media')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    
    try {
      if (!req.file || !req.file.buffer) return res.status(400).json({ success: false, message: 'Файл не получен' });
      
      const db = require('../db');
      const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      
      // Вычисляем SHA-256 хеш файла для дедупликации
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      
      // Проверяем, не загружен ли уже такой файл
      const existingFile = await db.getQuery()(
        'SELECT id, file_name FROM content_media WHERE file_hash = $1',
        [fileHash]
      );
      
      let mediaId;
      let fileName;
      
      if (existingFile.rows.length > 0) {
        // Файл уже существует - возвращаем существующую запись
        mediaId = existingFile.rows[0].id;
        fileName = existingFile.rows[0].file_name;
      } else {
        // Сохраняем новый файл в базу данных
        const { rows } = await db.getQuery()(`
          INSERT INTO content_media (
            file_data,
            file_name,
            mime_type,
            file_size,
            file_hash,
            media_type,
            author_address,
            page_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, file_name
        `, [
          req.file.buffer, // BYTEA данные
          req.file.originalname || 'unnamed',
          req.file.mimetype,
          req.file.size,
          fileHash,
          mediaType,
          req.session.address,
          req.body.page_id || null
        ]);
        
        mediaId = rows[0].id;
        fileName = rows[0].file_name;
      }
      
      // URL для доступа к файлу через API
      const fileUrl = `/api/uploads/media/${mediaId}/file`;
      // Используем относительный URL, чтобы frontend сам формировал полный URL
      // Это позволяет работать с разными портами (frontend на 9000, backend на 8000)
      const fullUrl = fileUrl;
      
      return res.json({ 
        success: true, 
        data: { 
          id: mediaId,
          url: fullUrl,
          type: mediaType,
          filename: fileName,
          originalName: req.file.originalname || 'unnamed',
          mimeType: req.file.mimetype,
          size: req.file.size,
          hash: fileHash,
          isDuplicate: existingFile.rows.length > 0
        } 
      });
    } catch (e) {
      console.error('Ошибка сохранения медиа в БД:', e);
      return res.status(500).json({ success: false, message: e.message });
    }
  });
});

// GET /api/uploads/media/:id/file - получить файл по ID
router.get('/media/:id/file', async (req, res) => {
  try {
    const db = require('../db');
    const mediaId = parseInt(req.params.id);
    
    const { rows } = await db.getQuery()(
      'SELECT file_data, file_name, mime_type, file_size FROM content_media WHERE id = $1',
      [mediaId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
    }
    
    const media = rows[0];
    
    // Устанавливаем заголовки для правильной отдачи файла
    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Content-Length', media.file_size);
    res.setHeader('Content-Disposition', `inline; filename="${media.file_name}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кеширование на 1 год
    
    // Отправляем бинарные данные
    res.send(media.file_data);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /api/uploads/media - получить список медиа-файлов
router.get('/media', auth.requireAuth, async (req, res) => {
  try {
    if (!req.session.address) {
      return res.status(403).json({ success: false, message: 'Требуется подключение кошелька' });
    }
    
    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    if (!userAccessLevel.hasAccess) {
      return res.status(403).json({ success: false, message: 'Требуются права редактора или админа' });
    }
    
    const db = require('../db');
    const { page_id, media_type, limit = 50, offset = 0 } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (page_id) {
      whereClause += ` AND page_id = $${paramIndex}`;
      params.push(parseInt(page_id));
      paramIndex++;
    }
    
    if (media_type) {
      whereClause += ` AND media_type = $${paramIndex}`;
      params.push(media_type);
      paramIndex++;
    }
    
    params.push(parseInt(limit));
    params.push(parseInt(offset));
    
    const { rows } = await db.getQuery()(`
      SELECT 
        id,
        page_id,
        file_name,
        mime_type,
        file_size,
        file_hash,
        media_type,
        alt_text,
        title,
        description,
        author_address,
        created_at,
        updated_at
      FROM content_media
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params);
    
    // Добавляем URL для каждого файла
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:8000';
    const mediaWithUrls = rows.map(media => ({
      ...media,
      url: `${protocol}://${host}/api/uploads/media/${media.id}/file`
    }));
    
    const { rows: countRows } = await db.getQuery()(`
      SELECT COUNT(*) as total
      FROM content_media
      ${whereClause}
    `, params.slice(0, -2));
    
    return res.json({
      success: true,
      data: mediaWithUrls,
      total: parseInt(countRows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PATCH /api/uploads/media/:id - обновить метаданные медиа (например, связать с документом)
router.patch('/media/:id', auth.requireAuth, async (req, res) => {
  try {
    if (!req.session.address) {
      return res.status(403).json({ success: false, message: 'Требуется подключение кошелька' });
    }
    
    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    if (!userAccessLevel.hasAccess) {
      return res.status(403).json({ success: false, message: 'Требуются права редактора или админа' });
    }
    
    const db = require('../db');
    const mediaId = parseInt(req.params.id);
    const { page_id, alt_text, title, description } = req.body;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (page_id !== undefined) {
      updates.push(`page_id = $${paramIndex}`);
      params.push(page_id ? parseInt(page_id) : null);
      paramIndex++;
    }
    
    if (alt_text !== undefined) {
      updates.push(`alt_text = $${paramIndex}`);
      params.push(alt_text || null);
      paramIndex++;
    }
    
    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(title || null);
      paramIndex++;
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Нет полей для обновления' });
    }
    
    params.push(mediaId);
    
    const { rows } = await db.getQuery()(`
      UPDATE content_media
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
    }
    
    return res.json({ success: true, data: rows[0] });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/uploads/media/:id - удалить медиа-файл
router.delete('/media/:id', auth.requireAuth, async (req, res) => {
  try {
    if (!req.session.address) {
      return res.status(403).json({ success: false, message: 'Требуется подключение кошелька' });
    }
    
    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    if (!userAccessLevel.hasAccess) {
      return res.status(403).json({ success: false, message: 'Требуются права редактора или админа' });
    }
    
    const db = require('../db');
    const mediaId = parseInt(req.params.id);
    
    // Проверяем существование файла
    const { rows: mediaRows } = await db.getQuery()(
      'SELECT id, file_hash FROM content_media WHERE id = $1',
      [mediaId]
    );
    
    if (mediaRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
    }
    
    // Проверяем, используется ли файл в других документах (если есть file_hash)
    const fileHash = mediaRows[0].file_hash;
    if (fileHash) {
      const { rows: usageRows } = await db.getQuery()(
        'SELECT COUNT(*) as count FROM content_media WHERE file_hash = $1',
        [fileHash]
      );
      
      // Если файл используется в нескольких местах, не удаляем данные, только связь
      if (parseInt(usageRows[0].count) > 1) {
        // Просто удаляем связь с документом, но оставляем файл
        await db.getQuery()(
          'UPDATE content_media SET page_id = NULL WHERE id = $1',
          [mediaId]
        );
        return res.json({ success: true, message: 'Связь с документом удалена, файл сохранен (используется в других местах)' });
      }
    }
    
    // Удаляем запись из БД (файл удалится вместе с записью)
    await db.getQuery()('DELETE FROM content_media WHERE id = $1', [mediaId]);
    
    return res.json({ success: true, message: 'Медиа-файл удален' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


