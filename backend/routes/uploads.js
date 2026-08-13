/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
const contentMediaLimits = require('../services/contentMediaLimits');
const contentMediaStore = require('../services/contentMediaStore');
const { fixUtf8Filename, fixMulterFile } = require('../utils/utf8Filename');

const router = express.Router();

async function requireCmsEditor(req, res) {
  const isAuthenticated = req.session.authenticated
    || req.session.userId
    || req.session.address;
  if (!isAuthenticated) {
    res.status(403).json({ success: false, message: 'Требуется аутентификация' });
    return false;
  }
  let level = req.session.userAccessLevel && req.session.userAccessLevel.level;
  if (req.session.address) {
    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    level = userAccessLevel && userAccessLevel.level;
  } else if (req.session.userId && level !== 'editor') {
    const db = require('../db');
    const userResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (userResult.rows[0]) level = userResult.rows[0].role;
  }
  if (level !== 'editor') {
    res.status(403).json({ success: false, message: 'Требуются права редактора' });
    return false;
  }
  return true;
}

function sendStoreError(res, e, fallbackMessage) {
  const status = e.status || 500;
  if (e.payload) {
    return res.status(status).json(e.payload);
  }
  return res.status(status).json({
    success: false,
    code: e.code,
    message: e.message || fallbackMessage,
  });
}

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

const mediaIncomingDir = path.join(__dirname, '..', 'uploads', 'content', 'tmp', 'incoming');
const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      try { fs.mkdirSync(mediaIncomingDir, { recursive: true }); } catch (_) {}
      cb(null, mediaIncomingDir);
    },
    filename: (req, file, cb) => {
      cb(null, `in-${crypto.randomUUID()}`);
    }
  }),
  limits: { fileSize: contentMediaLimits.MAX_VIDEO_BYTES },
  fileFilter: (req, file, cb) => {
    const kind = contentMediaLimits.isAllowedCmsMime(file.mimetype, file.originalname);
    if (!kind) {
      return cb(new Error('Разрешены изображения (PNG, JPG, GIF, WEBP, SVG), видео (MP4, WEBM, OGG, MOV, AVI) и аудио (MP3, WAV, OGG, M4A, AAC, WEBM)'));
    }
    cb(null, true);
  }
});

// POST /api/uploads/media/init — чанковая сессия
router.post('/media/init', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const { fileName, mimeType, size, pageId } = req.body || {};
    const data = await contentMediaStore.initChunkedUpload({
      fileName: fixUtf8Filename(fileName),
      mimeType,
      size,
      pageId: pageId ? parseInt(pageId, 10) : null,
      authorAddress: req.session.address,
    });
    return res.status(201).json({ success: true, data });
  } catch (e) {
    console.error('[uploads/media/init]', e.message);
    return sendStoreError(res, e, 'Ошибка инициализации загрузки');
  }
});

router.put(
  '/media/:uploadId/parts/:partNumber',
  auth.requireAuth,
  express.raw({ type: '*/*', limit: contentMediaLimits.PART_SIZE + 1024 }),
  async (req, res) => {
    try {
      if (!(await requireCmsEditor(req, res))) return;
      const data = await contentMediaStore.putPart({
        uploadId: req.params.uploadId,
        partNumber: req.params.partNumber,
        body: req.body,
      });
      return res.json({ success: true, ...data });
    } catch (e) {
      console.error('[uploads/media/parts]', e.message);
      return sendStoreError(res, e, 'Ошибка записи части');
    }
  }
);

router.get('/media/:uploadId/status', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const data = await contentMediaStore.getUploadStatus(req.params.uploadId);
    return res.json({ success: true, data });
  } catch (e) {
    return sendStoreError(res, e, 'Ошибка статуса загрузки');
  }
});

router.post('/media/:uploadId/complete', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const { row, isDuplicate } = await contentMediaStore.completeUpload(
      req.params.uploadId,
      req.body && req.body.parts
    );
    return res.json({
      success: true,
      data: contentMediaStore.uploadResponse(row, { isDuplicate }),
    });
  } catch (e) {
    console.error('[uploads/media/complete]', e.message);
    return sendStoreError(res, e, 'Ошибка сборки файла');
  }
});

router.post('/media/:uploadId/abort', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    await contentMediaStore.abortUpload(req.params.uploadId);
    return res.status(204).end();
  } catch (e) {
    return sendStoreError(res, e, 'Ошибка отмены загрузки');
  }
});

// POST /api/uploads/media — one-shot на диск (картинки / мелкие файлы)
router.post('/media', auth.requireAuth, async (req, res) => {
  if (!(await requireCmsEditor(req, res))) return;

  mediaUpload.single('media')(req, res, async (err) => {
    if (err) {
      console.error('[uploads/media] Ошибка multer:', err);
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        code: tooLarge ? 'MEDIA_TOO_LARGE' : undefined,
        message: tooLarge ? 'Файл слишком большой' : (err.message || 'Ошибка загрузки файла'),
      });
    }

    const tmpPath = req.file && req.file.path;
    try {
      if (!req.file || !tmpPath) {
        return res.status(400).json({ success: false, message: 'Файл не получен' });
      }
      fixMulterFile(req.file);
      if (!req.file.mimetype) {
        return res.status(400).json({ success: false, message: 'MIME тип файла не определен' });
      }

      let pageId = null;
      if (req.body && req.body.page_id) {
        const parsedPageId = parseInt(req.body.page_id, 10);
        if (!Number.isNaN(parsedPageId) && parsedPageId > 0) pageId = parsedPageId;
      }

      const { row, isDuplicate } = await contentMediaStore.ingestOneShotFromPath({
        tmpPath,
        originalName: fixUtf8Filename(req.file.originalname || 'unnamed'),
        mimeType: req.file.mimetype,
        size: req.file.size,
        authorAddress: req.session.address,
        pageId,
      });

      return res.json({
        success: true,
        data: contentMediaStore.uploadResponse(row, {
          isDuplicate,
          originalName: fixUtf8Filename(req.file.originalname || 'unnamed'),
        }),
      });
    } catch (e) {
      if (tmpPath) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      console.error('[uploads/media] Ошибка сохранения медиа:', {
        message: e.message,
        stack: e.stack,
        code: e.code,
      });
      if (res.headersSent || res.destroyed) return;
      if (e.payload) return res.status(e.status || 500).json(e.payload);
      let errorMessage = e.message || 'Внутренняя ошибка сервера';
      let statusCode = e.status || 500;
      if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
        errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
        statusCode = 503;
      }
      return res.status(statusCode).json({ success: false, code: e.code, message: errorMessage });
    }
  });
});

// Превью вложений чата/гостя для редактора — ДО /media/:id/file (иначе id=chat)
router.get('/media/chat/:id/file', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Неверный ID' });
    return contentMediaStore.streamChatAttachmentForEditor(req, res, { table: 'messages', id });
  } catch (e) {
    console.error('[uploads/media/chat/file]', e.message);
    if (!res.headersSent) return res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/media/guest/:id/file', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ success: false, message: 'Неверный ID' });
    return contentMediaStore.streamChatAttachmentForEditor(req, res, { table: 'unified_guest_messages', id });
  } catch (e) {
    console.error('[uploads/media/guest/file]', e.message);
    if (!res.headersSent) return res.status(500).json({ success: false, message: e.message });
  }
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
      'SELECT file_name, mime_type, file_size, storage, file_path, status FROM content_media WHERE id = $1',
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
    if (media.status && media.status !== 'ready') {
      releaseClient();
      cleanup();
      if (!res.headersSent && !res.destroyed) {
        return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
      }
      return;
    }
    const fileSize = parseInt(media.file_size) || 0;
    console.log(`[uploads/media/:id/file] Файл найден: ID ${mediaId}, размер: ${fileSize} bytes, тип: ${media.mime_type}`);

    if ((media.storage || 'bytea') === 'disk' && media.file_path) {
      releaseClient();
      cleanup();
      return contentMediaStore.streamDiskToResponse(req, res, {
        filePath: media.file_path,
        mimeType: media.mime_type,
        fileName: media.file_name,
        fileSize,
      });
    }

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
    // Соцсети/превьюеры тянут og:image с другого origin
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
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

// GET /api/uploads/media - список медиатеки (без file_data, относительный url)
// scope=cms (пикер) | scope=all (очистка: CMS+чат+гости)
router.get('/media', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const { page_id, media_type, q, limit, offset, scope, source } = req.query;
    const result = await contentMediaStore.listMedia({
      mediaType: media_type,
      pageId: page_id,
      q,
      limit,
      offset,
      scope: scope || 'cms',
      source,
    });
    return res.json({ success: true, ...result });
  } catch (e) {
    console.error('[uploads/media GET] Ошибка получения списка медиа:', {
      message: e.message,
      stack: e.stack
    });
    if (res.headersSent || res.destroyed) return;
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
    if (!(await requireCmsEditor(req, res))) return;
    
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
      RETURNING ${contentMediaStore.META_COLUMNS}
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

// DELETE /api/uploads/media/:id - удалить медиа (CMS) или байты вложения чата/гостя
// query/body source=cms|chat|guest (по умолчанию cms)
router.delete('/media/:id', auth.requireAuth, async (req, res) => {
  try {
    if (!(await requireCmsEditor(req, res))) return;
    const mediaId = parseInt(req.params.id, 10);
    const source = (req.query && req.query.source)
      || (req.body && req.body.source)
      || 'cms';
    const result = await contentMediaStore.deleteLibraryItem(mediaId, source);
    if (!result.deleted) {
      return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
    }
    return res.json({ success: true, message: 'Медиа-файл удален' });
  } catch (e) {
    console.error('[uploads/media/:id DELETE] Ошибка удаления медиа:', {
      message: e.message,
      stack: e.stack,
      mediaId: parseInt(req.params.id)
    });
    if (res.headersSent || res.destroyed) return;
    let statusCode = 500;
    let errorMessage = e.message || 'Внутренняя ошибка сервера';
    if (e.message && e.message.includes('timeout exceeded when trying to connect')) {
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
      statusCode = 503;
    }
    return res.status(statusCode).json({ success: false, message: errorMessage });
  }
});

setInterval(() => {
  contentMediaStore.gcExpiredUploads().catch((err) => {
    console.warn('[content-media] gc:', err.message);
  });
}, 60 * 60 * 1000);
setTimeout(() => {
  contentMediaStore.gcExpiredUploads().catch(() => {});
}, 20000);

module.exports = router;


