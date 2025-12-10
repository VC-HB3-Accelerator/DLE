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
      console.error('[uploads/media] Ошибка multer:', err);
      // Формируем понятное сообщение об ошибке
      let errorMessage = err.message || 'Ошибка загрузки файла';
      if (err.code === 'LIMIT_FILE_SIZE') {
        errorMessage = 'Файл слишком большой';
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        errorMessage = 'Неожиданный файл';
      }
      return res.status(400).json({ success: false, message: errorMessage });
    }
    
    try {
      if (!req.file) {
        console.error('[uploads/media] Файл не получен в req.file');
        return res.status(400).json({ success: false, message: 'Файл не получен' });
      }
      
      if (!req.file.buffer) {
        console.error('[uploads/media] Буфер файла отсутствует');
        return res.status(400).json({ success: false, message: 'Буфер файла отсутствует' });
      }
      
      if (!req.file.mimetype) {
        console.error('[uploads/media] MIME тип отсутствует');
        return res.status(400).json({ success: false, message: 'MIME тип файла не определен' });
      }
      
      const db = require('../db');
      const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
      
      console.log('[uploads/media] Начало обработки файла:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        mediaType: mediaType
      });
      
      // Вычисляем SHA-256 хеш файла для дедупликации
      const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      console.log('[uploads/media] Хеш файла вычислен:', fileHash.substring(0, 16) + '...');
      
      // Проверяем, не загружен ли уже такой файл
      const existingFile = await db.getQuery()(
        'SELECT id, file_name FROM content_media WHERE file_hash = $1',
        [fileHash]
      );
      
      let mediaId;
      let fileName;
      
      if (existingFile.rows.length > 0) {
        // Файл уже существует - возвращаем существующую запись
        console.log('[uploads/media] Файл уже существует, используем существующую запись:', existingFile.rows[0].id);
        mediaId = existingFile.rows[0].id;
        fileName = existingFile.rows[0].file_name;
      } else {
        // Сохраняем новый файл в базу данных
        console.log('[uploads/media] Сохранение нового файла в БД...');
        
        // Нормализуем page_id: преобразуем в число или null
        let pageId = null;
        if (req.body.page_id) {
          const parsedPageId = parseInt(req.body.page_id);
          if (!isNaN(parsedPageId) && parsedPageId > 0) {
            pageId = parsedPageId;
          }
        }
        
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
          pageId
        ]);
        
        mediaId = rows[0].id;
        fileName = rows[0].file_name;
        console.log('[uploads/media] Файл успешно сохранен в БД, ID:', mediaId);
      }
      
      // URL для доступа к файлу через API
      const fileUrl = `/api/uploads/media/${mediaId}/file`;
      // Используем относительный URL, чтобы frontend сам формировал полный URL
      // Это позволяет работать с разными портами (frontend на 9000, backend на 8000)
      const fullUrl = fileUrl;
      
      console.log('[uploads/media] Успешная загрузка, возвращаем ответ');
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
      console.error('[uploads/media] Ошибка сохранения медиа в БД:', {
        message: e.message,
        stack: e.stack,
        name: e.name,
        code: e.code,
        detail: e.detail,
        constraint: e.constraint,
        table: e.table,
        column: e.column
      });
      
      // Проверяем, можно ли отправлять ответ
      if (res.headersSent || res.destroyed) {
        console.error('[uploads/media] Ответ уже отправлен или соединение закрыто, пропускаем отправку ошибки');
        return;
      }
      
      // Формируем понятное сообщение об ошибке
      let errorMessage = e.message || 'Внутренняя ошибка сервера';
      let statusCode = 500;
      
      // Обработка ошибок подключения к БД
      if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
        errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
        statusCode = 503; // Service Unavailable
      } else if (e.detail) {
      // Если есть детали ошибки PostgreSQL, добавляем их к сообщению
        errorMessage += `: ${e.detail}`;
      } else if (e.constraint) {
        errorMessage += ` (нарушение ограничения: ${e.constraint})`;
      }
      
      return res.status(statusCode).json({ 
        success: false, 
        message: errorMessage
        // Убираем объект error, чтобы фронтенд не получал [object Object]
      });
    }
  });
});

// Middleware для логирования всех запросов к медиа-файлам
router.use('/media/:id/file', (req, res, next) => {
  const mediaId = parseInt(req.params.id);
  console.log(`[uploads/media/:id/file] MIDDLEWARE: Запрос к файлу ID: ${mediaId}, метод: ${req.method}, Range: ${req.headers.range || 'нет'}`);
  next();
});

// GET /api/uploads/media/:id/file - получить файл по ID с поддержкой Range requests
router.get('/media/:id/file', async (req, res) => {
  let client = null;
  let clientReleased = false; // Флаг для предотвращения двойного освобождения клиента
  const mediaId = parseInt(req.params.id);
  
  console.log(`[uploads/media/:id/file] HANDLER: Начало обработки запроса для файла ID: ${mediaId}`);
  
  // Валидация mediaId
  if (isNaN(mediaId) || mediaId <= 0) {
    console.error(`[uploads/media/:id/file] Неверный ID файла: ${req.params.id}`);
    if (!res.headersSent && !res.destroyed) {
    return res.status(400).json({ success: false, message: 'Неверный ID файла' });
    }
    return;
  }
  
  // Увеличиваем chunk size до 1MB для больших файлов - меньше запросов к БД
  const chunkSize = 1048576; // 1MB chunks для оптимальной производительности стриминга
  
  console.log(`[uploads/media/:id/file] Запрос файла ID: ${mediaId}, Range: ${req.headers.range || 'нет'}`);
  
  // Функция для безопасного освобождения клиента
  const releaseClient = () => {
    if (client && !clientReleased) {
      clientReleased = true;
      try {
        client.release();
      } catch (releaseErr) {
        console.error(`[uploads/media/:id/file] Ошибка освобождения клиента для файла ID ${mediaId}:`, releaseErr);
      }
    }
  };
  
  // Обработчики событий для очистки
  let connectionTimeoutHandle = null;
  let responseErrorHandler = null;
  let responseCloseHandler = null;
  
  // Функция для очистки всех обработчиков и таймеров
  const cleanup = () => {
    if (connectionTimeoutHandle) {
      clearTimeout(connectionTimeoutHandle);
      connectionTimeoutHandle = null;
    }
    if (responseErrorHandler && res.removeListener) {
      res.removeListener('error', responseErrorHandler);
    }
    if (responseCloseHandler && res.removeListener) {
      res.removeListener('close', responseCloseHandler);
    }
  };
  
  try {
    const db = require('../db');
    const pool = db.getPool();
    
    // Добавляем таймаут для подключения к пулу (10 секунд)
    const connectionTimeout = new Promise((_, reject) => {
      connectionTimeoutHandle = setTimeout(() => {
        reject(new Error('timeout exceeded when trying to connect'));
      }, 30000); // Увеличиваем таймаут до 30 секунд (было 10)
    });
    
    try {
      client = await Promise.race([
        pool.connect().then(client => {
          // Очищаем таймер при успешном подключении
          if (connectionTimeoutHandle) {
            clearTimeout(connectionTimeoutHandle);
            connectionTimeoutHandle = null;
          }
          return client;
        }),
        connectionTimeout
      ]);
    console.log(`[uploads/media/:id/file] Клиент БД подключен для файла ID: ${mediaId}`);
    } catch (connectErr) {
      // Очищаем таймер при ошибке
      if (connectionTimeoutHandle) {
        clearTimeout(connectionTimeoutHandle);
        connectionTimeoutHandle = null;
      }
      console.error(`[uploads/media/:id/file] Ошибка подключения к БД для файла ID ${mediaId}:`, {
        message: connectErr.message,
        stack: connectErr.stack
      });
      if (!res.headersSent && !res.destroyed) {
        return res.status(503).json({ 
          success: false, 
          message: 'Ошибка подключения к базе данных. Попробуйте позже.' 
        });
      }
      return;
    }
    
    // Проверяем, не закрыто ли соединение перед запросом к БД
    if (res.destroyed || res.headersSent) {
      releaseClient();
      cleanup();
      return;
    }
    
    // Сначала получаем метаданные без file_data
    let metaResult;
    try {
      metaResult = await client.query(
      'SELECT file_name, mime_type, file_size FROM content_media WHERE id = $1',
      [mediaId]
    );
    } catch (queryErr) {
      console.error(`[uploads/media/:id/file] Ошибка запроса метаданных для файла ID ${mediaId}:`, {
        message: queryErr.message,
        stack: queryErr.stack
      });
      releaseClient();
      cleanup();
      if (!res.headersSent && !res.destroyed) {
        return res.status(500).json({ success: false, message: 'Ошибка получения метаданных файла' });
      }
      return;
    }
    
    if (metaResult.rows.length === 0) {
      console.error(`[uploads/media/:id/file] Файл не найден: ID ${mediaId}`);
      releaseClient();
      cleanup();
      if (!res.headersSent && !res.destroyed) {
      return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
      }
      return;
    }
    
    const media = metaResult.rows[0];
    const fileSize = parseInt(media.file_size) || 0;
    console.log(`[uploads/media/:id/file] Файл найден: ID ${mediaId}, размер: ${fileSize} bytes, тип: ${media.mime_type}`);

    // Проверяем, не закрыто ли соединение перед установкой заголовков
    if (res.destroyed || res.headersSent) {
      releaseClient();
      cleanup();
      return;
    }

    // Поддержка HTTP Range requests для стриминга (как на YouTube/Vimeo)
    const range = req.headers.range;
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (range) {
      // Парсим Range заголовок (например: "bytes=0-1023" или "bytes=1024-")
      const parts = range.replace(/bytes=/, '').split('-');
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Валидация диапазона
      if (start >= fileSize || end >= fileSize || start < 0 || end < start) {
        if (!res.headersSent && !res.destroyed) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
          releaseClient();
          cleanup();
          return res.status(416).end(); // Range Not Satisfiable
        }
        releaseClient();
        cleanup();
        return;
      }
      
      statusCode = 206; // Partial Content
    }

    const contentLength = end - start + 1;

    // Устанавливаем заголовки для правильной отдачи файла с поддержкой Range
    // Проверяем, не закрыто ли соединение перед установкой заголовков
    if (res.destroyed || res.headersSent) {
      releaseClient();
      return;
    }
    
    res.setHeader('Content-Type', media.mime_type);
    res.setHeader('Accept-Ranges', 'bytes'); // Указываем, что поддерживаем Range requests
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Кеширование на 1 год
    
    // Правильное кодирование имени файла для HTTP заголовков (RFC 5987)
    // Экранируем специальные символы и используем ASCII для совместимости
    const safeFileName = media.file_name
      .replace(/"/g, '\\"')  // Экранируем кавычки
      .replace(/\n/g, '')     // Убираем переносы строк
      .replace(/\r/g, '');    // Убираем возврат каретки
    
    // Для кириллицы и специальных символов используем RFC 5987 формат
    const encodedFileName = encodeURIComponent(media.file_name);
    
    if (range) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.status(statusCode);
    } else {
      // Используем оба формата: ASCII для совместимости и UTF-8 для корректного отображения
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);
    }

    // Используем прямой стриминг BYTEA данных частями через SQL substring
    // Начинаем с нужной позиции (для Range requests)
    let offset = start + 1; // PostgreSQL substring использует 1-based индексацию
    const endOffset = end + 1;
    
    const streamChunk = async () => {
      try {
        // Проверяем, не освобожден ли клиент или не закрыто ли соединение
        if (clientReleased || !client || res.destroyed) {
          if (!clientReleased) {
            releaseClient();
          }
          if (!res.destroyed && res.headersSent) {
            res.end();
          }
          return; // Клиент уже освобожден или соединение закрыто, прекращаем стриминг
        }

        // Проверяем, не достигли ли мы конца запрошенного диапазона
        if (offset > endOffset) {
          // Достигнут конец запрошенного диапазона
          releaseClient();
          if (!res.destroyed) {
          res.end();
          }
          return;
        }

        // Вычисляем размер текущего chunk (может быть меньше chunkSize для последнего chunk)
        const currentChunkSize = Math.min(chunkSize, endOffset - offset + 1);
        
        // Читаем следующий chunk данных, используя encode для получения hex-строки
        let chunkResult;
        try {
          chunkResult = await client.query(
          `SELECT encode(substring(file_data FROM $1 FOR $2), 'hex') as chunk_hex FROM content_media WHERE id = $3`,
          [offset, currentChunkSize, mediaId]
        );
        } catch (queryErr) {
          // Если ошибка запроса, но соединение закрыто - просто выходим
          if (res.destroyed || clientReleased) {
            return;
          }
          throw queryErr; // Пробрасываем ошибку дальше для обработки
        }

        if (chunkResult.rows.length === 0 || !chunkResult.rows[0] || !chunkResult.rows[0].chunk_hex) {
          // Достигнут конец файла или данные отсутствуют
          releaseClient();
          if (!res.destroyed) {
          res.end();
          }
          return;
        }

        const chunkHex = chunkResult.rows[0].chunk_hex;
        
        // Если chunk пустой, значит достигнут конец
        if (!chunkHex || chunkHex.length === 0) {
          releaseClient();
          if (!res.destroyed) {
          res.end();
          }
          return;
        }
        
        // Преобразуем hex-строку в Buffer
        const buffer = Buffer.from(chunkHex, 'hex');

        // Проверяем, не закрыто ли соединение перед отправкой данных
        if (res.destroyed) {
          releaseClient();
          return;
        }

        // Отправляем chunk клиенту
        if (!res.write(buffer)) {
          // Буфер переполнен, ждем события 'drain'
          res.once('drain', () => {
            // Проверяем, не освобожден ли клиент и не закрыто ли соединение перед продолжением
            if (!clientReleased && client && !res.destroyed) {
              offset += currentChunkSize;
              streamChunk();
            } else {
              releaseClient();
            }
          });
        } else {
          // Продолжаем отправку следующего chunk
          if (!clientReleased && client && !res.destroyed) {
            offset += currentChunkSize;
            streamChunk();
          } else {
            releaseClient();
          }
        }
      } catch (chunkErr) {
        // Игнорируем ошибки, если клиент уже освобожден или соединение закрыто
        if (clientReleased || res.destroyed) {
          return;
        }
        
        console.error('[uploads/media/:id/file] Ошибка чтения chunk:', {
          message: chunkErr.message,
          stack: chunkErr.stack,
          offset: offset,
          endOffset: endOffset,
          fileSize: fileSize
        });
        releaseClient();
        // Если заголовки еще не отправлены, отправляем ошибку
        if (!res.headersSent && !res.destroyed) {
          res.status(500).json({ success: false, message: 'Ошибка чтения файла' });
        } else if (!res.destroyed) {
          // Если заголовки уже отправлены, просто завершаем соединение
          res.end();
        }
      }
    };

    // Начинаем стриминг
    streamChunk();

    // Обработка ошибок HTTP ответа
    responseErrorHandler = (resErr) => {
      console.error(`[uploads/media/:id/file] Ошибка HTTP ответа для файла ID ${mediaId}:`, resErr);
      releaseClient();
      cleanup();
    };
    res.on('error', responseErrorHandler);

    // Обработка закрытия соединения клиентом
    responseCloseHandler = () => {
      // Если соединение закрыто клиентом до завершения стриминга, освобождаем клиент
      if (!clientReleased) {
        console.log(`[uploads/media/:id/file] Соединение закрыто клиентом для файла ID ${mediaId}, освобождаем клиент БД`);
        releaseClient();
      }
      cleanup();
    };
    res.on('close', responseCloseHandler);

  } catch (e) {
    releaseClient();
    cleanup();
    
    console.error(`[uploads/media/:id/file] Ошибка получения файла ID ${mediaId}:`, {
      message: e.message,
      stack: e.stack,
      name: e.name,
      code: e.code,
      detail: e.detail,
      constraint: e.constraint,
      table: e.table,
      column: e.column,
      mediaId: mediaId
    });
    
    // Проверяем, можно ли отправлять ответ
    if (!res.headersSent && !res.destroyed) {
      // Для ошибок подключения к БД возвращаем специальный статус
      const statusCode = e.message && e.message.includes('timeout exceeded when trying to connect') ? 503 : 500;
      const message = e.message && e.message.includes('timeout exceeded when trying to connect') 
        ? 'Ошибка подключения к базе данных. Попробуйте позже.'
        : (e.message || 'Внутренняя ошибка сервера');
        
      return res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? {
          name: e.name,
          code: e.code,
          detail: e.detail,
          constraint: e.constraint
        } : undefined
      });
    }
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
    console.error('[uploads/media GET] Ошибка получения списка медиа:', {
      message: e.message,
      stack: e.stack
    });
    
    // Проверяем, можно ли отправлять ответ
    if (res.headersSent || res.destroyed) {
      console.error('[uploads/media GET] Ответ уже отправлен или соединение закрыто');
      return;
    }
    
    // Обработка ошибок подключения к БД
    let statusCode = 500;
    let errorMessage = e.message || 'Внутренняя ошибка сервера';
    
    if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
      statusCode = 503;
    }
    
    return res.status(statusCode).json({ success: false, message: errorMessage });
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
    console.error('[uploads/media/:id PATCH] Ошибка обновления медиа:', {
      message: e.message,
      stack: e.stack,
      mediaId: parseInt(req.params.id)
    });
    
    // Проверяем, можно ли отправлять ответ
    if (res.headersSent || res.destroyed) {
      console.error('[uploads/media/:id PATCH] Ответ уже отправлен или соединение закрыто');
      return;
    }
    
    // Обработка ошибок подключения к БД
    let statusCode = 500;
    let errorMessage = e.message || 'Внутренняя ошибка сервера';
    
    if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
      statusCode = 503;
    }
    
    return res.status(statusCode).json({ success: false, message: errorMessage });
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
    console.error('[uploads/media/:id DELETE] Ошибка удаления медиа:', {
      message: e.message,
      stack: e.stack,
      mediaId: parseInt(req.params.id)
    });
    
    // Проверяем, можно ли отправлять ответ
    if (res.headersSent || res.destroyed) {
      console.error('[uploads/media/:id DELETE] Ответ уже отправлен или соединение закрыто');
      return;
    }
    
    // Обработка ошибок подключения к БД
    let statusCode = 500;
    let errorMessage = e.message || 'Внутренняя ошибка сервера';
    
    if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
      statusCode = 503;
    }
    
    return res.status(statusCode).json({ success: false, message: errorMessage });
  }
});

module.exports = router;


