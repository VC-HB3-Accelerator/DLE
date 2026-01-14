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

const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const vectorSearchClient = require('../services/vectorSearchClient');
const logger = require('../utils/logger');
const { preRenderBlog } = require('../scripts/pre-render-blog');

const FIELDS_TO_EXCLUDE = ['image', 'tags'];

// Проверка и создание общей таблицы для всех админов
async function ensureAdminPagesTable(fields) {
  fields = fields.filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  const tableName = `admin_pages_simple`;
  
  // Получаем ключ шифрования
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  
  if (!existsRes.rows[0].exists) {
    // Формируем SQL для создания таблицы с зашифрованными полями
    let columns = [
      'id SERIAL PRIMARY KEY',
      'author_address_encrypted TEXT NOT NULL', // Зашифрованный адрес автора
      'created_at TIMESTAMP DEFAULT NOW()',
      'updated_at TIMESTAMP DEFAULT NOW()',
      'show_in_blog BOOLEAN DEFAULT FALSE', // Показывать в блоге
      'slug TEXT UNIQUE', // URL-friendly идентификатор для SEO
      'category_id INTEGER', // ID категории
      'parent_id INTEGER', // ID родительской страницы
      'order_index INTEGER DEFAULT 0', // Порядок сортировки
      'nav_path TEXT', // Путь навигации
      'is_index_page BOOLEAN DEFAULT FALSE' // Является ли индексной страницей
    ];
    for (const field of fields) {
      columns.push(`"${field}_encrypted" TEXT`);
    }
    const sql = `CREATE TABLE ${tableName} (${columns.join(', ')})`;
    await db.getQuery()(sql);
  } else {
    // Проверяем, есть ли все нужные столбцы, и добавляем недостающие
    const colRes = await db.getQuery()(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]
    );
    const existingCols = colRes.rows.map(r => r.column_name);
    
    // Добавляем поле author_address_encrypted если его нет
    if (!existingCols.includes('author_address_encrypted')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN author_address_encrypted TEXT`
      );
    }
    
    // Добавляем поле show_in_blog если его нет (не зашифрованное поле)
    if (!existingCols.includes('show_in_blog')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN show_in_blog BOOLEAN DEFAULT FALSE`
      );
    }
    
    // Добавляем поле slug если его нет
    if (!existingCols.includes('slug')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN slug TEXT`
      );
      // Создаем уникальный индекс для slug
      try {
        await db.getQuery()(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${tableName}_slug_unique ON ${tableName}(slug) WHERE slug IS NOT NULL`
        );
      } catch (e) {
        // Индекс может уже существовать, игнорируем ошибку
        console.log('[pages] Индекс для slug уже существует или ошибка создания:', e.message);
      }
    }
    
    // Добавляем поле category_id если его нет
    if (!existingCols.includes('category_id')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN category_id INTEGER`
      );
    }
    
    // Добавляем поле parent_id если его нет
    if (!existingCols.includes('parent_id')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN parent_id INTEGER`
      );
    }
    
    // Добавляем поле order_index если его нет
    if (!existingCols.includes('order_index')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN order_index INTEGER DEFAULT 0`
      );
    }
    
    // Добавляем поле nav_path если его нет
    if (!existingCols.includes('nav_path')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN nav_path TEXT`
      );
    }
    
    // Добавляем поле is_index_page если его нет
    if (!existingCols.includes('is_index_page')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN is_index_page BOOLEAN DEFAULT FALSE`
      );
    }
    
    for (const field of fields) {
      const encryptedField = `${field}_encrypted`;
      if (!existingCols.includes(encryptedField)) {
        await db.getQuery()(
          `ALTER TABLE ${tableName} ADD COLUMN "${encryptedField}" TEXT`
        );
      }
    }
  }
  return { tableName, encryptionKey };
}

// Конфигурация загрузки файлов для юридических документов
// Храним файлы там, откуда их раздаёт express.static('/uploads', path.join(__dirname, 'uploads'))
const uploadsRoot = path.join(__dirname, '..', 'uploads');
const legalDir = path.join(uploadsRoot, 'legal');
if (!fs.existsSync(legalDir)) {
  try { fs.mkdirSync(legalDir, { recursive: true }); } catch (e) {}
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, legalDir);
  },
  filename: function (req, file, cb) {
    const safeName = Date.now() + '-' + (file.originalname || 'file');
    cb(null, safeName);
  }
});
const upload = multer({ storage });

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Генерирует URL-friendly slug из текста
 * @param {string} text - Исходный текст
 * @param {number} maxLength - Максимальная длина slug (по умолчанию 100)
 * @returns {string} - Сгенерированный slug
 */
function generateSlug(text, maxLength = 100) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    // Транслитерация кириллицы в латиницу
    .replace(/[а-яё]/g, (char) => {
      const map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
      };
      return map[char] || char;
    })
    // Заменяем все не-латинские символы и цифры на дефисы
    .replace(/[^a-z0-9]+/g, '-')
    // Убираем дефисы в начале и конце
    .replace(/^-+|-+$/g, '')
    // Ограничиваем длину
    .substring(0, maxLength)
    .replace(/-+$/, ''); // Убираем дефис в конце после обрезки
}

/**
 * Генерирует уникальный slug, проверяя существование в БД
 * @param {string} title - Заголовок страницы
 * @param {number} pageId - ID страницы (для исключения при проверке уникальности)
 * @param {string} tableName - Имя таблицы
 * @returns {Promise<string>} - Уникальный slug
 */
async function generateUniqueSlug(title, pageId, tableName) {
  let baseSlug = generateSlug(title);
  if (!baseSlug) {
    // Если slug пустой, используем id
    baseSlug = `page-${pageId || Date.now()}`;
  }
  
  let slug = baseSlug;
  let counter = 1;
  
  // Проверяем уникальность
  while (true) {
    let query = `SELECT id FROM ${tableName} WHERE slug = $1`;
    const params = [slug];
    
    // Если это редактирование, исключаем текущую страницу
    if (pageId) {
      query += ` AND id != $2`;
      params.push(pageId);
    }
    
    const result = await db.getQuery()(query, params);
    
    if (result.rows.length === 0) {
      // Slug уникален
      return slug;
    }
    
    // Slug уже существует, добавляем номер
    slug = `${baseSlug}-${counter}`;
    counter++;
    
    // Защита от бесконечного цикла
    if (counter > 1000) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }
  
  return slug;
}

// Middleware для условной обработки multer (только для multipart/form-data)
const conditionalUpload = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    return upload.single('file')(req, res, next);
  }
  // Для JSON запросов пропускаем multer
  next();
};

// Создать страницу (только для админа)
router.post('/', conditionalUpload, async (req, res) => {
  console.log('[pages] POST /: Начало обработки запроса на создание страницы');
  console.log('[pages] POST /: Content-Type:', req.headers['content-type']);
  console.log('[pages] POST /: req.body тип:', typeof req.body);
  console.log('[pages] POST /: req.body ключи:', req.body ? Object.keys(req.body) : 'req.body пуст');
  console.log('[pages] POST /: req.body содержимое:', JSON.stringify(req.body || {}, null, 2).substring(0, 500));
  console.log('[pages] POST /: req.file:', req.file ? { name: req.file.originalname, size: req.file.size } : 'нет файла');
  
  try {
    if (!req.session || !req.session.authenticated) {
      console.log('[pages] POST /: Ошибка аутентификации - сессия не найдена');
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    if (!req.session.address) {
      console.log('[pages] POST /: Ошибка - адрес кошелька не найден');
      return res.status(403).json({ error: 'Требуется подключение кошелька' });
    }
    
    console.log('[pages] POST /: Проверка прав доступа для адреса:', req.session.address);
    // Проверяем роль админа через токены в кошельке
    const authService = require('../services/auth-service');
    let userAccessLevel;
    try {
      userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    } catch (authError) {
      console.error('[pages] POST /: Ошибка при проверке прав доступа:', authError);
      if (authError.message && authError.message.includes('timeout exceeded')) {
        return res.status(503).json({ error: 'Ошибка подключения к базе данных. Попробуйте позже.' });
      }
      throw authError;
    }
    
    if (!userAccessLevel.hasAccess) {
      console.log('[pages] POST /: Доступ запрещен - недостаточно прав');
      return res.status(403).json({ error: 'Only admin can create pages' });
    }
    
    console.log('[pages] POST /: Права доступа подтверждены, уровень:', userAccessLevel.level);
    
    const authorAddress = req.session.address;
    const tableName = `admin_pages_simple`;

    // Собираем данные страницы
    const bodyRaw = req.body || {};
    
    // Проверяем, что body не пустой
    if (!bodyRaw || Object.keys(bodyRaw).length === 0) {
      console.error('[pages] POST /: req.body пуст или не определен');
      return res.status(400).json({ 
        error: 'Отсутствуют данные страницы',
        message: 'Тело запроса пустое. Проверьте Content-Type и формат данных.'
      });
    }
    
    // Обрабатываем required_permission: если это пустая строка или 'null', устанавливаем null
    let requiredPermission = null;
    if (bodyRaw.required_permission) {
      const perm = String(bodyRaw.required_permission).trim();
      requiredPermission = (perm && perm !== 'null' && perm !== '') ? perm : null;
    }
    
    // Обрабатываем JSON поля (seo, settings) - могут прийти как строка из FormData
    let seoValue = null;
    if (bodyRaw.seo) {
      if (typeof bodyRaw.seo === 'string') {
        try {
          seoValue = JSON.parse(bodyRaw.seo);
        } catch (e) {
          seoValue = bodyRaw.seo.trim() ? bodyRaw.seo : null;
        }
      } else if (typeof bodyRaw.seo === 'object') {
        seoValue = bodyRaw.seo;
      }
    }
    
    let settingsValue = null;
    if (bodyRaw.settings) {
      if (typeof bodyRaw.settings === 'string') {
        try {
          settingsValue = JSON.parse(bodyRaw.settings);
        } catch (e) {
          settingsValue = bodyRaw.settings.trim() ? bodyRaw.settings : null;
        }
      } else if (typeof bodyRaw.settings === 'object') {
        settingsValue = bodyRaw.settings;
      }
    }
    
    const pageData = {
      title: bodyRaw.title || '',
      summary: bodyRaw.summary || '',
      content: bodyRaw.content || '',
      seo: seoValue,
      status: bodyRaw.status || 'draft',
      settings: settingsValue,
      visibility: bodyRaw.visibility || 'public',
      required_permission: requiredPermission,
      format: bodyRaw.format || (req.file ? (req.file.mimetype?.startsWith('image/') ? 'image' : 'pdf') : 'html'),
      mime_type: req.file ? (req.file.mimetype || null) : (bodyRaw.mime_type || (bodyRaw.format === 'html' ? 'text/html' : null)),
      storage_type: req.file ? 'file' : (bodyRaw.storage_type || 'embedded'),
      file_path: req.file ? path.join('/uploads', 'legal', path.basename(req.file.path)) : (bodyRaw.file_path || null),
      size_bytes: req.file ? req.file.size : (bodyRaw.size_bytes || null),
      checksum: bodyRaw.checksum || null,
      // Нормализуем категорию: приводим к нижнему регистру для консистентности
      category: (bodyRaw.category && String(bodyRaw.category).trim()) ? String(bodyRaw.category).trim().toLowerCase() : null,
      // Обрабатываем category_id: может быть null или числом
      category_id: (bodyRaw.category_id && bodyRaw.category_id !== 'null' && bodyRaw.category_id !== '') 
        ? (() => { const parsed = parseInt(bodyRaw.category_id); return isNaN(parsed) ? null : parsed; })()
        : null,
      // Обрабатываем parent_id: может быть null или числом
      parent_id: (bodyRaw.parent_id && bodyRaw.parent_id !== 'null' && bodyRaw.parent_id !== '') 
        ? (() => { const parsed = parseInt(bodyRaw.parent_id); return isNaN(parsed) ? null : parsed; })()
        : null,
      // Обрабатываем order_index: должно быть числом
      order_index: (bodyRaw.order_index && bodyRaw.order_index !== 'null' && bodyRaw.order_index !== '') 
        ? (() => { const parsed = parseInt(bodyRaw.order_index); return isNaN(parsed) ? 0 : parsed; })()
        : 0,
      nav_path: bodyRaw.nav_path || null,
      is_index_page: bodyRaw.is_index_page === true || bodyRaw.is_index_page === 'true',
      show_in_blog: bodyRaw.show_in_blog === true || bodyRaw.show_in_blog === 'true' || bodyRaw.show_in_blog === true
    };

    console.log('[pages] POST /: Создание страницы, данные:', {
      title: pageData.title,
      visibility: pageData.visibility,
      required_permission: pageData.required_permission,
      status: pageData.status,
      format: pageData.format
    });

    // Генерируем slug из заголовка (если не передан вручную)
    let slug = bodyRaw.slug && bodyRaw.slug.trim() 
      ? bodyRaw.slug.trim() 
      : await generateUniqueSlug(pageData.title, null, tableName);
    
    // Добавляем slug в pageData
    pageData.slug = slug;

    // Формируем SQL для вставки данных (включаем все поля, даже null)
    // Фильтруем только undefined, null значения включаем (они допустимы в БД)
    const dataEntries = Object.entries(pageData).filter(([k, v]) => {
      // Исключаем только undefined, null и пустые строки для некоторых полей допустимы
      return v !== undefined;
    });
    
    const colNames = ['author_address', ...dataEntries.map(([k]) => k)].join(', ');
    const values = [authorAddress, ...dataEntries.map(([, v]) => v)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) RETURNING *`;
    
    console.log('[pages] POST /: SQL запрос:', sql.substring(0, 300) + '...');
    console.log('[pages] POST /: Количество параметров:', values.length);
    console.log('[pages] POST /: Колонки:', colNames);
    console.log('[pages] POST /: Значения (первые 5):', values.slice(0, 5).map(v => v === null ? 'NULL' : (typeof v === 'string' ? v.substring(0, 50) : v)));
    
    // Проверяем, что ответ еще не был отправлен перед запросом к БД
    if (res.headersSent || res.destroyed) {
      console.error('[pages] POST /: Ответ уже отправлен перед запросом к БД');
      return;
    }
    
    console.log('[pages] POST /: Выполнение SQL запроса к БД...');
    let rows;
    try {
      const result = await db.getQuery()(sql, values);
      rows = result.rows;
      console.log('[pages] POST /: SQL запрос выполнен успешно, создана страница с ID:', rows[0]?.id);
    } catch (dbError) {
      console.error('[pages] POST /: Ошибка БД при выполнении SQL:', dbError);
      console.error('[pages] POST /: Код ошибки БД:', dbError.code);
      console.error('[pages] POST /: Сообщение БД:', dbError.message);
      console.error('[pages] POST /: Детали БД:', dbError.detail);
      throw dbError;
    }
    const created = rows[0];

    // Проверяем еще раз перед отправкой ответа
    if (res.headersSent || res.destroyed) {
      console.error('[pages] POST /: Ответ уже отправлен после запроса к БД');
      return;
    }

    // Индексация выполняется ТОЛЬКО вручную через кнопку "Индекс" (POST /:id/reindex)
    // Автоматическая индексация при создании отключена

    // Запускаем pre-rendering для блога, если страница публичная и для блога
    if (created.visibility === 'public' && 
        created.status === 'published' && 
        created.show_in_blog && 
        created.slug && 
        typeof created.slug === 'string' && 
        created.slug.trim() !== '') {
      // Запускаем асинхронно, не блокируя ответ
      preRenderBlog({ 
        renderList: true, 
        renderArticles: true,
        specificSlug: created.slug.trim() 
      }).catch(err => {
        console.error('[pages] Ошибка pre-rendering при создании страницы:', err);
      });
    }

    res.json(created);
  } catch (error) {
    console.error('[pages] Ошибка при создании страницы:', error);
    console.error('[pages] Стек ошибки:', error.stack);
    console.error('[pages] Код ошибки:', error.code);
    console.error('[pages] Сообщение ошибки:', error.message);
    
    // Если ответ уже отправлен, не пытаемся отправлять ошибку
    if (res.headersSent || res.destroyed) {
      console.error('[pages] POST /: Ответ уже отправлен в catch блоке');
      return;
    }
    
    // Определяем статус код на основе типа ошибки
    let statusCode = 500;
    let errorMessage = 'Ошибка при создании страницы';
    
    if (error.message && error.message.includes('timeout exceeded when trying to connect')) {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
    } else if (error.code === '23505') { // PostgreSQL unique violation
      statusCode = 409; // Conflict
      errorMessage = 'Страница с такими данными уже существует';
    } else if (error.code === '23502') { // PostgreSQL not null violation
      statusCode = 400; // Bad Request
      errorMessage = 'Отсутствует обязательное поле: ' + (error.column || 'неизвестно');
    } else if (error.code === '42703') { // PostgreSQL undefined column
      statusCode = 400; // Bad Request
      errorMessage = 'Неверное поле в запросе: ' + (error.message || 'неизвестно');
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage
    });
  }
});

// Получить все страницы админов
router.get('/', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can view pages' });
  }
  
  const tableName = `admin_pages_simple`;
  
  // Получаем ключ шифрования
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.json([]);
  
  // Получаем все страницы всех админов
  const { rows } = await db.getQuery()(`
    SELECT * FROM ${tableName} 
    ORDER BY created_at DESC
  `);
  
  res.json(rows);
});

// ========== РОУТЫ ДЛЯ КАТЕГОРИЙ (должны быть ПЕРЕД параметрическими роутами типа /:id) ==========

// Создать категорию
router.post('/categories', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can create categories' });
  }
  
  try {
    const { name, display_name, description, order_index } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название категории обязательно' });
    }
    
    const normalizedName = name.trim().toLowerCase();
    const displayName = display_name || name.trim();
    
    // Проверяем, не существует ли уже категория с таким названием
    const existsRes = await db.getQuery()(
      `SELECT id FROM document_categories WHERE name = $1`,
      [normalizedName]
    );
    
    if (existsRes.rows.length > 0) {
      return res.status(409).json({ error: 'Категория с таким названием уже существует' });
    }
    
    // Создаем категорию
    const { rows } = await db.getQuery()(
      `INSERT INTO document_categories (name, display_name, description, order_index, author_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [normalizedName, displayName, description || null, order_index || 0, req.session.address]
    );
    
    console.log(`[pages] POST /categories: создана категория "${normalizedName}"`);
    res.json(rows[0]);
  } catch (error) {
    console.error('[pages] Ошибка создания категории:', error);
    // Если таблица не существует, возвращаем успех (для обратной совместимости)
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      console.warn('[pages] Таблица document_categories не существует, пропускаем создание');
      res.json({ name: req.body.name.trim().toLowerCase(), display_name: req.body.name.trim() });
    } else {
      res.status(500).json({ error: 'Ошибка создания категории: ' + error.message });
    }
  }
});

// Удалить категорию
router.delete('/categories/:name', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can delete categories' });
  }
  
  try {
    const categoryName = decodeURIComponent(req.params.name).toLowerCase();
    
    if (categoryName === 'uncategorized') {
      return res.status(400).json({ error: 'Нельзя удалить категорию "Без категории"' });
    }
    
    // Удаляем категорию
    const { rows } = await db.getQuery()(
      `DELETE FROM document_categories WHERE name = $1 RETURNING *`,
      [categoryName]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Категория не найдена' });
    }
    
    console.log(`[pages] DELETE /categories/:name: удалена категория "${categoryName}"`);
    res.json({ success: true, deleted: rows[0] });
  } catch (error) {
    console.error('[pages] Ошибка удаления категории:', error);
    // Если таблица не существует, возвращаем успех (для обратной совместимости)
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      console.warn('[pages] Таблица document_categories не существует, пропускаем удаление');
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Ошибка удаления категории: ' + error.message });
    }
  }
});

// Получить список всех категорий (для выпадающего списка)
router.get('/categories', async (req, res) => {
  try {
    // Сначала пытаемся получить категории из таблицы document_categories
    try {
      const categoriesRes = await db.getQuery()(
        `SELECT name, display_name FROM document_categories ORDER BY order_index, created_at`
      );
      if (categoriesRes.rows.length > 0) {
        const categories = categoriesRes.rows.map(row => row.name);
        return res.json(categories);
      }
    } catch (err) {
      console.warn('[pages] Таблица document_categories не существует, используем старый метод');
    }
    
    // Fallback: получаем категории из документов
    const tableName = `admin_pages_simple`;
    
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }
    
    // Получаем уникальные категории из опубликованных публичных страниц
    const { rows } = await db.getQuery()(`
      SELECT DISTINCT category
      FROM ${tableName}
      WHERE visibility = 'public' 
        AND status = 'published'
        AND category IS NOT NULL
        AND category != ''
      ORDER BY category ASC
    `);
    
    const categories = rows.map(row => row.category).filter(Boolean);
    res.json(categories);
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ========== КОНЕЦ РОУТОВ ДЛЯ КАТЕГОРИЙ ==========

// Получить одну страницу по id (с проверкой прав доступа)
router.get('/:id', async (req, res) => {
  try {
    // Если пользователь не авторизован, проверяем параметры для автоматической авторизации
    if (!req.session || !req.session.authenticated) {
      const telegramId = req.query.telegramId;
      const email = req.query.email;
      
      // Пытаемся автоматически авторизовать пользователя через Telegram/Email
      if (telegramId || email) {
        const identityService = require('../services/identity-service');
        const authService = require('../services/auth-service');
        
        let user = null;
        if (telegramId) {
          user = await identityService.findUserByIdentity('telegram', telegramId);
        } else if (email) {
          user = await identityService.findUserByIdentity('email', email);
        }
        
        if (user) {
          // Автоматически создаем сессию для пользователя
          req.session.userId = user.id;
          req.session.authenticated = true;
          if (telegramId) {
            req.session.telegramId = telegramId;
            req.session.authType = 'telegram';
          } else if (email) {
            req.session.email = email;
            req.session.authType = 'email';
          }
          
          // Проверяем, есть ли у пользователя связанный кошелек
          const { getLinkedWallet } = require('../services/wallet-service');
          const linkedWallet = await getLinkedWallet(user.id);
          
          if (linkedWallet) {
            // Если есть кошелек - проверяем токены и определяем роль по балансу
            try {
              req.session.address = linkedWallet;
              const userAccessLevel = await authService.getUserAccessLevel(linkedWallet);
              req.session.userAccessLevel = userAccessLevel;
              logger.info(`[pages/:id] Автоматическая авторизация с кошельком: ${telegramId ? 'telegram' : 'email'}, user: ${user.id}, wallet: ${linkedWallet}, role: ${userAccessLevel.level}`);
            } catch (walletError) {
              // Если ошибка при проверке токенов, используем роль из БД
              logger.warn(`[pages/:id] Ошибка проверки токенов для кошелька ${linkedWallet}, используем роль из БД:`, walletError);
              req.session.userAccessLevel = { 
                level: user.role || 'user', 
                tokenCount: 0, 
                hasAccess: true 
              };
            }
          } else {
            // Если кошелька нет - используем роль из БД
            req.session.userAccessLevel = { 
              level: user.role || 'user', 
              tokenCount: 0, 
              hasAccess: true 
            };
            logger.info(`[pages/:id] Автоматическая авторизация без кошелька: ${telegramId ? 'telegram' : 'email'}, user: ${user.id}, role: ${user.role || 'user'}`);
          }
          
          await req.session.save();
        } else {
          return res.status(401).json({ error: 'Требуется аутентификация' });
        }
      } else {
        return res.status(401).json({ error: 'Требуется аутентификация' });
      }
    }
    
    const tableName = `admin_pages_simple`;
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
    
    const { rows } = await db.getQuery()(
      `SELECT * FROM ${tableName} WHERE id = $1`, 
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Page not found' });
    
    const page = rows[0];
    
    // Проверяем доступ к странице в зависимости от её видимости
    // authService уже объявлен выше при автоматической авторизации, используем его
    let role = 'user';
    let userAccessLevel = { level: 'user', tokenCount: 0, hasAccess: true };
    
    // Используем userAccessLevel из сессии, если он уже установлен (при автоматической авторизации)
    if (req.session.userAccessLevel) {
      userAccessLevel = req.session.userAccessLevel;
      role = userAccessLevel.level;
    } else if (req.session.address) {
      // Для пользователей с кошельком проверяем токены
      const authService = require('../services/auth-service');
      userAccessLevel = await authService.getUserAccessLevel(req.session.address);
      role = userAccessLevel.level;
    } else if (req.session.userId) {
      // Для Telegram/Email пользователей без кошелька используем роль из БД
      const roleResult = await db.getQuery()('SELECT role FROM users WHERE id = $1', [
        req.session.userId,
      ]);
      
      if (roleResult.rows.length > 0) {
        role = roleResult.rows[0].role;
        // Преобразуем роль в формат userAccessLevel
        if (role === 'editor') {
          userAccessLevel = { level: 'editor', tokenCount: 5999998, hasAccess: true };
        } else if (role === 'readonly') {
          userAccessLevel = { level: 'readonly', tokenCount: 100, hasAccess: true };
        } else {
          // Для роли 'user' даем доступ к внутренним документам
          userAccessLevel = { level: 'user', tokenCount: 0, hasAccess: true };
        }
      }
    }
    
    // Публичные страницы доступны всем
    if (page.visibility === 'public' && page.status === 'published') {
      return res.json(page);
    }
    
    // Внутренние страницы требуют проверки прав
    if (page.visibility === 'internal') {
      // Редактор видит все внутренние страницы (включая черновики)
      if (role === 'editor') {
        return res.json(page);
      }
      
      // Обычные пользователи видят только опубликованные внутренние страницы
      if (page.status !== 'published') {
        return res.status(403).json({ error: 'Доступ запрещен: страница не опубликована' });
      }
      
      // Если у страницы указан required_permission, проверяем права пользователя
      if (page.required_permission) {
        const { PERMISSIONS, hasPermission } = require('../shared/permissions');
        // Проверяем права доступа пользователя
        // VIEW_BASIC_DOCS доступно всем аутентифицированным пользователям (user, readonly, editor)
        // VIEW_LEGAL_DOCS требует readonly или editor
        // MANAGE_LEGAL_DOCS требует editor
        if (page.required_permission === PERMISSIONS.VIEW_BASIC_DOCS && !hasPermission(role, PERMISSIONS.VIEW_BASIC_DOCS)) {
          return res.status(403).json({ error: 'Доступ запрещен: требуется авторизация' });
        }
        if (page.required_permission === PERMISSIONS.VIEW_LEGAL_DOCS && !hasPermission(role, PERMISSIONS.VIEW_LEGAL_DOCS)) {
          return res.status(403).json({ error: 'Доступ запрещен: требуются права читателя' });
        }
        if (page.required_permission === PERMISSIONS.MANAGE_LEGAL_DOCS && !hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS)) {
          return res.status(403).json({ error: 'Доступ запрещен: требуются права редактора' });
        }
      }
      
      // Если required_permission не указан или права проверены, возвращаем страницу
      return res.json(page);
    }
    
    // Для всех остальных случаев (например, draft публичных страниц) требуется роль редактора
    if (role !== 'editor') {
      return res.status(403).json({ error: 'Доступ запрещен: требуются права редактора' });
    }
    
    res.json(page);
  } catch (error) {
    console.error('[pages] Ошибка получения страницы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Ручная переиндексация документа в vector-search (только для админа)
router.post('/:id/reindex', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }

  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can reindex pages' });
  }

  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()( `SELECT to_regclass($1) as exists`, [tableName] );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });

  const { rows } = await db.getQuery()( `SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id] );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  const page = rows[0];

  if (page.format !== 'html') {
    return res.status(422).json({ error: 'Индексация поддерживается только для HTML' });
  }

  const text = stripHtml(page.content || '');
  if (!text) {
    return res.status(422).json({ error: 'Пустое содержимое для индексации' });
  }

  try {
    const url = page.visibility === 'public' && page.status === 'published'
      ? `/public/page/${page.id}`
      : `/content/page/${page.id}`;
    
    // Удаляем старые чанки документа перед реиндексацией
    // Удаляем возможные чанки (doc_id_chunk_0, doc_id_chunk_1, ...) и сам документ (doc_id)
    const oldRowIds = [String(page.id)]; // Удаляем основной документ
    // Также удаляем возможные чанки (до 100 чанков на документ)
    for (let i = 0; i < 100; i++) {
      oldRowIds.push(`${page.id}_chunk_${i}`);
    }
    
    try {
      await vectorSearchClient.remove('legal_docs', oldRowIds);
      console.log(`[pages] Удалены старые чанки документа ${page.id} перед реиндексацией`);
    } catch (removeError) {
      console.warn(`[pages] Ошибка удаления старых чанков (продолжаем индексацию):`, removeError.message);
      // Продолжаем индексацию даже если удаление не удалось
    }
    
    // Используем Semantic Chunking для разбивки документа
    const semanticChunkingService = require('../services/semanticChunkingService');
    const docLength = text.length;
    const useLLM = docLength <= 8000;

    const chunks = await semanticChunkingService.chunkDocument(text, {
      maxChunkSize: 1500,
      overlap: 200,
      useLLM
    });

    // Индексируем каждый чанк отдельно
    const rowsToUpsert = chunks.map((chunk, index) => ({
      row_id: `${page.id}_chunk_${index}`,
      text: chunk.text,
      metadata: {
        doc_id: page.id,
        chunk_index: index,
        section: chunk.metadata?.section || 'Документ',
        parent_doc_id: page.id,
        title: page.title,
        url: `${url}#chunk_${index}`,
        visibility: page.visibility,
        required_permission: page.required_permission,
        format: page.format,
        updated_at: page.updated_at || null,
        isComplete: chunk.metadata?.isComplete || false
      }
    }));

    if (chunks.length > 1) {
      console.log(`[pages] Документ ${page.id} разбит на ${chunks.length} чанков при реиндексации`);
      await vectorSearchClient.upsert('legal_docs', rowsToUpsert);
    } else {
      // Если чанк один, индексируем как раньше
    await vectorSearchClient.upsert('legal_docs', [{
      row_id: page.id,
      text,
      metadata: {
        doc_id: page.id,
        title: page.title,
        url,
        visibility: page.visibility,
        required_permission: page.required_permission,
        format: page.format,
        updated_at: page.updated_at || null
      }
    }]);
    }

    res.json({ success: true, chunksCount: chunks.length });
  } catch (e) {
    console.error('[pages] manual reindex error:', e.message);
    res.status(500).json({ error: 'Ошибка индексации' });
  }
});

// Редактировать страницу по id
router.patch('/:id', upload.single('file'), async (req, res) => {
  console.log('[pages] PATCH /:id: Начало обработки запроса на обновление страницы ID:', req.params.id);
  try {
    if (!req.session || !req.session.authenticated) {
      console.log('[pages] PATCH /:id: Ошибка аутентификации - сессия не найдена');
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    if (!req.session.address) {
      console.log('[pages] PATCH /:id: Ошибка - адрес кошелька не найден');
      return res.status(403).json({ error: 'Требуется подключение кошелька' });
    }
    
    console.log('[pages] PATCH /:id: Проверка прав доступа для адреса:', req.session.address);
    // Проверяем роль админа через токены в кошельке
    const authService = require('../services/auth-service');
    let userAccessLevel;
    try {
      userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    } catch (authError) {
      console.error('[pages] PATCH /:id: Ошибка при проверке прав доступа:', authError);
      if (authError.message && authError.message.includes('timeout exceeded')) {
        return res.status(503).json({ error: 'Ошибка подключения к базе данных. Попробуйте позже.' });
      }
      throw authError;
    }
    
    if (!userAccessLevel.hasAccess) {
      console.log('[pages] PATCH /:id: Доступ запрещен - недостаточно прав');
      return res.status(403).json({ error: 'Only admin can edit pages' });
    }
    
    console.log('[pages] PATCH /:id: Права доступа подтверждены, уровень:', userAccessLevel.level);
  
  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const incoming = req.body || {};
  const updateData = {};
  
  console.log(`[pages] PATCH /:id (${req.params.id}): получены данные для обновления:`, JSON.stringify(incoming, null, 2));
  console.log(`[pages] PATCH /:id (${req.params.id}): тип req.body:`, typeof req.body);
  console.log(`[pages] PATCH /:id (${req.params.id}): ключи в req.body:`, Object.keys(incoming));
  
  // Обрабатываем required_permission: 
  // Если visibility меняется на public, required_permission должен быть null
  // Если visibility = internal и нет required_permission, устанавливаем null
  if ('visibility' in incoming && incoming.visibility === 'public') {
    updateData.required_permission = null;
  } else if ('required_permission' in incoming) {
    if (incoming.required_permission) {
      const perm = String(incoming.required_permission).trim();
      updateData.required_permission = (perm && perm !== 'null' && perm !== '') ? perm : null;
    } else {
      updateData.required_permission = null;
    }
  }
  
  for (const [k, v] of Object.entries(incoming)) {
    if (FIELDS_TO_EXCLUDE.includes(k)) continue;
    if (k === 'required_permission') continue; // Уже обработано выше
    
    // Обрабатываем show_in_blog как boolean
    if (k === 'show_in_blog') {
      updateData[k] = v === true || v === 'true' || v === 1 || v === '1';
      continue;
    }
    
    // Обрабатываем slug
    if (k === 'slug') {
      if (v && String(v).trim()) {
        // Если slug передан, проверяем уникальность
        const uniqueSlug = await generateUniqueSlug(v, pageId, tableName);
        updateData[k] = uniqueSlug;
      } else if (incoming.title) {
        // Если slug не передан, но есть title, генерируем из title
        const uniqueSlug = await generateUniqueSlug(incoming.title, pageId, tableName);
        updateData[k] = uniqueSlug;
      }
      continue;
    }
    
    // Нормализуем категорию: приводим к нижнему регистру для консистентности
    if (k === 'category') {
      updateData[k] = (v && String(v).trim()) ? String(v).trim().toLowerCase() : null;
    }
    // Обрабатываем category_id: может быть null или числом
    else if (k === 'category_id') {
      if (v === null || v === 'null' || v === '' || v === undefined) {
        updateData[k] = null;
      } else {
        const parsed = parseInt(v);
        updateData[k] = isNaN(parsed) ? null : parsed;
      }
    }
    // Обрабатываем parent_id: может быть null или числом
    else if (k === 'parent_id') {
      if (v === null || v === 'null' || v === '' || v === undefined) {
        updateData[k] = null;
      } else {
        const parsed = parseInt(v);
        updateData[k] = isNaN(parsed) ? null : parsed;
      }
    }
    // Обрабатываем order_index: должно быть числом
    else if (k === 'order_index') {
      if (v === null || v === 'null' || v === '' || v === undefined) {
        updateData[k] = 0;
      } else {
        const parsed = parseInt(v);
        updateData[k] = isNaN(parsed) ? 0 : parsed;
      }
    }
    // Обрабатываем is_index_page: должно быть boolean
    else if (k === 'is_index_page') {
      updateData[k] = v === true || v === 'true' || v === 1 || v === '1';
    }
    // Обрабатываем JSON поля (seo, settings) - могут прийти как строка из FormData
    else if (k === 'seo' || k === 'settings') {
      if (typeof v === 'string') {
        try {
          // Если это строка JSON, пытаемся распарсить
          const parsed = JSON.parse(v);
          updateData[k] = parsed;
        } catch (e) {
          // Если не JSON, сохраняем как строку или null
          updateData[k] = v && v.trim() ? v : null;
        }
      } else if (typeof v === 'object' && v !== null) {
        // Если это уже объект, сериализуем в JSON
        updateData[k] = v;
      } else {
        updateData[k] = v || null;
      }
    }
    // Остальные поля
    else {
      updateData[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    }
  }
  
  console.log(`[pages] PATCH /:id (${req.params.id}): обработанные данные для обновления:`, updateData);
  if (req.file) {
    updateData.format = req.file.mimetype?.startsWith('image/') ? 'image' : 'pdf';
    updateData.mime_type = req.file.mimetype || null;
    updateData.storage_type = 'file';
    updateData.file_path = path.join('/uploads', 'legal', path.basename(req.file.path));
    updateData.size_bytes = req.file.size;
  }
  const entries = Object.entries(updateData);
  if (!entries.length) return res.status(400).json({ error: 'No fields to update' });
  const setClause = entries.map(([f], i) => `"${f}" = $${i + 1}`).join(', ');
  const values = entries.map(([, v]) => v);
  values.push(req.params.id);

  const sql = `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${entries.length + 1} RETURNING *`;
  console.log(`[pages] PATCH /:id (${req.params.id}): SQL запрос:`, sql);
  console.log(`[pages] PATCH /:id (${req.params.id}): значения:`, values);
  
  // Проверяем, что ответ еще не был отправлен перед запросом к БД
  if (res.headersSent || res.destroyed) {
    console.error('[pages] PATCH /:id: Ответ уже отправлен перед запросом к БД');
    return;
  }
  
  console.log('[pages] PATCH /:id: Выполнение SQL запроса к БД...');
  let rows;
  try {
    const result = await db.getQuery()(sql, values);
    rows = result.rows;
  } catch (dbError) {
    console.error('[pages] PATCH /:id: Ошибка БД при выполнении SQL:', dbError);
    console.error('[pages] PATCH /:id: Код ошибки БД:', dbError.code);
    console.error('[pages] PATCH /:id: Сообщение БД:', dbError.message);
    console.error('[pages] PATCH /:id: Детали БД:', dbError.detail);
    
    // Если ответ уже отправлен, не пытаемся отправлять ошибку
    if (res.headersSent || res.destroyed) {
      console.error('[pages] PATCH /:id: Ответ уже отправлен в catch блоке БД');
      return;
    }
    
    // Определяем статус код на основе типа ошибки
    let statusCode = 500;
    let errorMessage = 'Ошибка при обновлении страницы';
    
    if (dbError.message && dbError.message.includes('timeout exceeded when trying to connect')) {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
    } else if (dbError.code === '23505') { // PostgreSQL unique violation
      statusCode = 409; // Conflict
      errorMessage = 'Страница с такими данными уже существует';
    } else if (dbError.code === '23502') { // PostgreSQL not null violation
      statusCode = 400; // Bad Request
      errorMessage = 'Отсутствует обязательное поле: ' + (dbError.column || 'неизвестно');
    } else if (dbError.code === '42703') { // PostgreSQL undefined column
      statusCode = 400; // Bad Request
      errorMessage = 'Неверное поле в запросе: ' + (dbError.message || 'неизвестно');
    } else if (dbError.message) {
      errorMessage = dbError.message;
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage
    });
  }
  
  if (!rows.length) {
    console.error('[pages] PATCH /:id: Страница не найдена после обновления');
    return res.status(404).json({ error: 'Page not found' });
  }
  
  const updated = rows[0];
  
  console.log(`[pages] PATCH /:id (${req.params.id}): страница успешно обновлена:`, {
    id: updated.id,
    title: updated.title,
    category: updated.category,
    parent_id: updated.parent_id,
    order_index: updated.order_index,
    is_index_page: updated.is_index_page,
    visibility: updated.visibility,
    required_permission: updated.required_permission
  });

  // Проверяем еще раз перед отправкой ответа
  if (res.headersSent || res.destroyed) {
    console.error('[pages] PATCH /:id: Ответ уже отправлен после запроса к БД');
    return;
  }

  // Индексация выполняется ТОЛЬКО вручную через кнопку "Индекс" (POST /:id/reindex)
  // Автоматическая индексация при обновлении отключена

  // Запускаем pre-rendering для блога, если страница публичная и для блога
  if (updated.visibility === 'public' && 
      updated.status === 'published' && 
      updated.show_in_blog && 
      updated.slug && 
      typeof updated.slug === 'string' && 
      updated.slug.trim() !== '') {
    // Запускаем асинхронно, не блокируя ответ
    preRenderBlog({ 
      renderList: true, 
      renderArticles: true,
      specificSlug: updated.slug.trim() 
    }).catch(err => {
      console.error('[pages] Ошибка pre-rendering при обновлении страницы:', err);
    });
  }

  res.json(updated);
  } catch (error) {
    console.error('[pages] PATCH /:id: Ошибка при обновлении страницы:', error);
    console.error('[pages] PATCH /:id: Стек ошибки:', error.stack);
    console.error('[pages] PATCH /:id: Код ошибки:', error.code);
    console.error('[pages] PATCH /:id: Сообщение ошибки:', error.message);
    
    // Если ответ уже отправлен, не пытаемся отправлять ошибку
    if (res.headersSent || res.destroyed) {
      console.error('[pages] PATCH /:id: Ответ уже отправлен в catch блоке');
      return;
    }
    
    // Определяем статус код на основе типа ошибки
    let statusCode = 500;
    let errorMessage = 'Ошибка при обновлении страницы';
    
    if (error.message && error.message.includes('timeout exceeded when trying to connect')) {
      statusCode = 503; // Service Unavailable
      errorMessage = 'Ошибка подключения к базе данных. Попробуйте позже.';
    } else if (error.code === '23505') { // PostgreSQL unique violation
      statusCode = 409; // Conflict
      errorMessage = 'Страница с такими данными уже существует';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: errorMessage
    });
  }
});

// Удалить страницу по id
router.delete('/:id', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can delete pages' });
  }
  
  const tableName = `admin_pages_simple`;
  const pageId = parseInt(req.params.id);
  
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  // Сначала получаем информацию о странице перед удалением
  const pageResult = await db.getQuery()(
    `SELECT * FROM ${tableName} WHERE id = $1`, 
    [pageId]
  );
  if (!pageResult.rows.length) return res.status(404).json({ error: 'Page not found' });
  const pageToDelete = pageResult.rows[0];
  
  // Находим все медиа-файлы, связанные с этой страницей
  try {
    const mediaResult = await db.getQuery()(
      `SELECT id, file_hash FROM content_media WHERE page_id = $1`,
      [pageId]
    );
    
    const deletedMediaCount = mediaResult.rows.length;
    console.log(`[pages] Найдено ${deletedMediaCount} медиа-файлов, связанных со страницей ${pageId}`);
    
    // Для каждого медиа-файла проверяем, используется ли он в других местах
    for (const media of mediaResult.rows) {
      if (media.file_hash) {
        // Проверяем, сколько раз используется этот файл (по file_hash)
        const usageResult = await db.getQuery()(
          `SELECT COUNT(*) as count FROM content_media WHERE file_hash = $1`,
          [media.file_hash]
        );
        const usageCount = parseInt(usageResult.rows[0].count);
        
        // Если файл используется только один раз (только в этой странице), удаляем его полностью
        if (usageCount === 1) {
          await db.getQuery()(
            `DELETE FROM content_media WHERE id = $1`,
            [media.id]
          );
          console.log(`[pages] Удален медиа-файл ID ${media.id} (file_hash: ${media.file_hash}), использовался только в удаляемой странице`);
        } else {
          // Если файл используется в других местах, просто убираем связь со страницей
          await db.getQuery()(
            `UPDATE content_media SET page_id = NULL WHERE id = $1`,
            [media.id]
          );
          console.log(`[pages] Убрана связь медиа-файла ID ${media.id} со страницей ${pageId} (файл используется в ${usageCount} местах)`);
        }
      } else {
        // Если file_hash отсутствует, просто удаляем файл
        await db.getQuery()(
          `DELETE FROM content_media WHERE id = $1`,
          [media.id]
        );
        console.log(`[pages] Удален медиа-файл ID ${media.id} (без file_hash)`);
      }
    }
    
    if (deletedMediaCount > 0) {
      console.log(`[pages] Обработано ${deletedMediaCount} медиа-файлов при удалении страницы ${pageId}`);
    }
  } catch (mediaError) {
    console.error('[pages] Ошибка при удалении медиа-файлов:', mediaError);
    // Продолжаем удаление страницы даже если произошла ошибка с медиа-файлами
  }
  
  // Удаляем страницу
  const { rows } = await db.getQuery()(
    `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, 
    [pageId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  const deleted = rows[0];
  
  // Удаляем из векторного поиска
  try {
    if (deleted && deleted.format === 'html') {
      // Удаляем документ и все его чанки
      const rowIdsToDelete = [String(deleted.id)]; // Основной документ
      // Удаляем возможные чанки (до 100 чанков на документ)
      for (let i = 0; i < 100; i++) {
        rowIdsToDelete.push(`${deleted.id}_chunk_${i}`);
      }
      await vectorSearchClient.remove('legal_docs', rowIdsToDelete);
      console.log(`[pages] Удалены документ ${deleted.id} и все его чанки из векторного поиска`);
    }
  } catch (e) {
    console.error('[pages] vector remove error:', e.message);
  }
  
  res.json(deleted);
});

// Публичные маршруты для просмотра страниц (доступны всем пользователям)
// Получить все опубликованные страницы
router.get('/public/all', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }
    
    // Поддержка фильтрации по категории и родителю
    const { category, parent_id, search } = req.query;
    let whereClause = `WHERE visibility = 'public' AND status = 'published'`;
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (parent_id !== undefined) {
      if (parent_id === null || parent_id === 'null' || parent_id === '') {
        whereClause += ` AND parent_id IS NULL`;
      } else {
        const parsed = parseInt(parent_id);
        if (!isNaN(parsed)) {
          whereClause += ` AND parent_id = $${paramIndex}`;
          params.push(parsed);
          paramIndex++;
        }
      }
    }
    
    if (search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Сортировка: сначала по категории, затем по order_index, затем по created_at
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      ${whereClause}
      ORDER BY 
        COALESCE(category, '') ASC,
        COALESCE(order_index, 0) ASC,
        created_at DESC
    `, params);
    
    console.log(`[pages] GET /public/all: найдено ${rows.length} публичных документов`);
    if (rows.length > 0) {
      console.log(`[pages] Примеры документов:`, rows.slice(0, 3).map(r => ({ id: r.id, title: r.title, category: r.category })));
    }
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения публичных страниц:', error);
    // Возвращаем пустой массив вместо объекта с ошибкой, чтобы фронтенд не ломался
    console.error('[pages] GET /public/all: ошибка, возвращаем пустой массив');
    res.status(500).json([]);
  }
});

// Получить все страницы блога (только с show_in_blog = true)
router.get('/blog/all', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }
    
    // Поддержка фильтрации по категории и поиску
    const { category, search } = req.query;
    let whereClause = `WHERE visibility = 'public' AND status = 'published' AND show_in_blog = TRUE`;
    const params = [];
    let paramIndex = 1;
    
    if (category) {
      whereClause += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    if (search) {
      whereClause += ` AND (title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Сортировка: сначала по дате создания (новые первыми), затем по order_index
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      ${whereClause}
      ORDER BY 
        created_at DESC,
        COALESCE(order_index, 0) ASC
    `, params);
    
    console.log(`[pages] GET /blog/all: найдено ${rows.length} страниц блога`);
    
    // Обрабатываем результаты: генерируем slug для страниц, у которых его нет
    const processedRows = await Promise.all(rows.map(async (row) => {
      // Если у страницы нет slug, генерируем его из title
      if (!row.slug || row.slug.trim() === '') {
        try {
          // Получаем расшифрованный title для генерации slug
          const encryptionUtils = require('../utils/encryptionUtils');
          const encryptionKey = encryptionUtils.getEncryptionKey();
          
          // Расшифровываем title (если он зашифрован)
          let title = row.title;
          if (row.title_encrypted) {
            const titleResult = await db.getQuery()(
              `SELECT decrypt_text($1, $2) as title`,
              [row.title_encrypted, encryptionKey]
            );
            title = titleResult.rows[0]?.title || row.title || `page-${row.id}`;
          }
          
          // Генерируем slug
          const newSlug = await generateUniqueSlug(title, row.id, tableName);
          
          // Обновляем slug в БД
          await db.getQuery()(
            `UPDATE ${tableName} SET slug = $1 WHERE id = $2`,
            [newSlug, row.id]
          );
          
          // Обновляем slug в объекте row
          row.slug = newSlug;
          
          console.log(`[pages] GET /blog/all: сгенерирован slug "${newSlug}" для страницы ${row.id}`);
        } catch (error) {
          console.error(`[pages] GET /blog/all: ошибка генерации slug для страницы ${row.id}:`, error);
          // Если не удалось сгенерировать slug, используем id как fallback
          row.slug = `page-${row.id}`;
        }
      }
      
      return row;
    }));
    
    res.json(processedRows);
  } catch (error) {
    console.error('Ошибка получения страниц блога:', error);
    res.status(500).json([]);
  }
});

// Получить страницу блога по slug
router.get('/blog/:slug', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    let slug = req.params.slug;
    
    // Декодируем slug (на случай если он был закодирован)
    try {
      slug = decodeURIComponent(slug);
    } catch (e) {
      // Если декодирование не удалось, используем как есть
      console.warn('[pages] Ошибка декодирования slug:', e.message);
    }
    
    // Валидация slug
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return res.status(400).json({ error: 'Невалидный slug' });
    }
    
    slug = slug.trim();
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    // Получаем страницу по slug
    const { rows } = await db.getQuery()(
      `SELECT * FROM ${tableName} 
       WHERE slug = $1 
       AND visibility = 'public' 
       AND status = 'published' 
       AND show_in_blog = TRUE
       LIMIT 1`,
      [slug]
    );
    
    console.log(`[pages] GET /blog/:slug: поиск по slug "${slug}", найдено строк: ${rows.length}`);
    
    if (rows.length === 0) {
      // Пробуем найти страницу без учета регистра и пробелов
      const { rows: rowsCaseInsensitive } = await db.getQuery()(
        `SELECT * FROM ${tableName} 
         WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1))
         AND visibility = 'public' 
         AND status = 'published' 
         AND show_in_blog = TRUE
         LIMIT 1`,
        [slug]
      );
      
      if (rowsCaseInsensitive.length > 0) {
        console.log(`[pages] GET /blog/:slug: найдено с учетом регистра, slug в БД: "${rowsCaseInsensitive[0].slug}"`);
        return res.json(rowsCaseInsensitive[0]);
      }
      
      // Показываем все доступные slug для отладки (только в dev режиме)
      if (process.env.NODE_ENV !== 'production') {
        const { rows: allSlugs } = await db.getQuery()(
          `SELECT id, slug, title FROM ${tableName} 
           WHERE visibility = 'public' 
           AND status = 'published' 
           AND show_in_blog = TRUE
           LIMIT 10`
        );
        console.log(`[pages] GET /blog/:slug: доступные slug:`, allSlugs.map(r => ({ id: r.id, slug: r.slug })));
      }
      
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    console.log(`[pages] GET /blog/:slug: страница найдена, id: ${rows[0].id}, slug: ${rows[0].slug}`);
    
    // Расшифровываем зашифрованные поля
    const page = rows[0];
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Создаем объект с расшифрованными данными
    const decryptedPage = { ...page };
    
    // Расшифровываем поля, если они зашифрованы
    const fieldsToDecrypt = ['title', 'summary', 'content', 'seo', 'settings'];
    for (const field of fieldsToDecrypt) {
      const encryptedField = `${field}_encrypted`;
      if (page[encryptedField]) {
        try {
          const decryptResult = await db.getQuery()(
            `SELECT decrypt_text($1, $2) as ${field}`,
            [page[encryptedField], encryptionKey]
          );
          if (decryptResult.rows[0] && decryptResult.rows[0][field] !== null) {
            decryptedPage[field] = decryptResult.rows[0][field];
          }
        } catch (decryptError) {
          console.warn(`[pages] GET /blog/:slug: ошибка расшифровки поля ${field}:`, decryptError.message);
          // Если расшифровка не удалась, оставляем оригинальное значение или null
          if (page[field]) {
            decryptedPage[field] = page[field];
          }
        }
      } else if (page[field]) {
        // Если поле не зашифровано, используем его как есть
        decryptedPage[field] = page[field];
      }
    }
    
    res.json(decryptedPage);
  } catch (error) {
    console.error('Ошибка получения страницы блога по slug:', error);
    res.status(500).json({ error: 'Ошибка получения страницы' });
  }
});

// Получить публичную страницу по slug (для /content/published)
router.get('/published/:slug', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    let slug = req.params.slug;
    
    // Декодируем slug (на случай если он был закодирован)
    try {
      slug = decodeURIComponent(slug);
    } catch (e) {
      console.warn('[pages] Ошибка декодирования slug:', e.message);
    }
    
    // Валидация slug
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return res.status(400).json({ error: 'Невалидный slug' });
    }
    
    slug = slug.trim();
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    // Получаем страницу по slug (без условия show_in_blog)
    const { rows } = await db.getQuery()(
      `SELECT * FROM ${tableName} 
       WHERE slug = $1 
       AND visibility = 'public' 
       AND status = 'published'
       LIMIT 1`,
      [slug]
    );
    
    console.log(`[pages] GET /published/:slug: поиск по slug "${slug}", найдено строк: ${rows.length}`);
    
    if (rows.length === 0) {
      // Пробуем найти страницу без учета регистра
      const { rows: rowsCaseInsensitive } = await db.getQuery()(
        `SELECT * FROM ${tableName} 
         WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1))
         AND visibility = 'public' 
         AND status = 'published'
         LIMIT 1`,
        [slug]
      );
      
      if (rowsCaseInsensitive.length > 0) {
        console.log(`[pages] GET /published/:slug: найдено с учетом регистра, slug в БД: "${rowsCaseInsensitive[0].slug}"`);
        return res.json(rowsCaseInsensitive[0]);
      }
      
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    console.log(`[pages] GET /published/:slug: страница найдена, id: ${rows[0].id}, slug: ${rows[0].slug}`);
    
    // Расшифровываем зашифрованные поля
    const page = rows[0];
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Создаем объект с расшифрованными данными
    const decryptedPage = { ...page };
    
    // Расшифровываем поля, если они зашифрованы
    const fieldsToDecrypt = ['title', 'summary', 'content', 'seo', 'settings'];
    for (const field of fieldsToDecrypt) {
      const encryptedField = `${field}_encrypted`;
      if (page[encryptedField]) {
        try {
          const decryptResult = await db.getQuery()(
            `SELECT decrypt_text($1, $2) as ${field}`,
            [page[encryptedField], encryptionKey]
          );
          if (decryptResult.rows[0] && decryptResult.rows[0][field] !== null) {
            decryptedPage[field] = decryptResult.rows[0][field];
          }
        } catch (decryptError) {
          console.warn(`[pages] GET /published/:slug: ошибка расшифровки поля ${field}:`, decryptError.message);
          if (page[field]) {
            decryptedPage[field] = page[field];
          }
        }
      } else if (page[field]) {
        decryptedPage[field] = page[field];
      }
    }
    
    res.json(decryptedPage);
  } catch (error) {
    console.error('Ошибка получения публичной страницы по slug:', error);
    res.status(500).json({ error: 'Ошибка получения страницы' });
  }
});

// Получить иерархическую структуру всех публичных страниц
router.get('/public/structure', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json({ categories: [] });
    }
    
    // Получаем все опубликованные публичные страницы
    const { rows } = await db.getQuery()(`
      SELECT 
        id,
        title,
        summary,
        category,
        parent_id,
        order_index,
        nav_path,
        is_index_page,
        created_at
      FROM ${tableName} 
      WHERE visibility = 'public' AND status = 'published'
      ORDER BY 
        COALESCE(category, '') ASC,
        COALESCE(order_index, 0) ASC,
        created_at ASC
    `);
    
    // Группируем по категориям и строим иерархию
    const categories = {};
    const pagesById = {};
    
    console.log(`[pages] GET /public/structure: найдено ${rows.length} страниц`);
    
    rows.forEach(page => {
      pagesById[page.id] = {
        ...page,
        children: []
      };
      
      // Нормализуем категорию: приводим к нижнему регистру для консистентности
      const cat = (page.category && String(page.category).trim()) 
        ? String(page.category).trim().toLowerCase() 
        : 'uncategorized';
      if (!categories[cat]) {
        categories[cat] = {
          name: cat,
          pages: []
        };
      }
    });
    
    // Строим иерархию
    rows.forEach(page => {
      const pageObj = pagesById[page.id];
      if (page.parent_id && pagesById[page.parent_id]) {
        // Дочерний документ - добавляем в children родителя
        pagesById[page.parent_id].children.push(pageObj);
      } else {
        // Родительский документ (без parent_id) - добавляем в категорию
        // Нормализуем категорию: приводим к нижнему регистру для консистентности
        const cat = (page.category && String(page.category).trim()) 
          ? String(page.category).trim().toLowerCase() 
          : 'uncategorized';
        // Убеждаемся, что категория существует (на случай, если она была создана только в первом цикле)
        if (!categories[cat]) {
          categories[cat] = {
            name: cat,
            pages: []
          };
        }
        categories[cat].pages.push(pageObj);
      }
    });
    
    // Сортируем children внутри каждого родительского документа
    Object.values(categories).forEach(cat => {
      cat.pages.forEach(page => {
        if (page.children && Array.isArray(page.children) && page.children.length > 0) {
          page.children.sort((a, b) => {
            if (a.order_index !== b.order_index) {
              return (a.order_index || 0) - (b.order_index || 0);
            }
            return new Date(a.created_at) - new Date(b.created_at);
          });
        }
      });
    });
    
    // Загружаем все категории из таблицы document_categories (включая пустые)
    try {
      const categoriesRes = await db.getQuery()(
        `SELECT name, display_name, description, order_index 
         FROM document_categories 
         ORDER BY order_index, created_at`
      );
      categoriesRes.rows.forEach(cat => {
        const normalizedName = cat.name.toLowerCase();
        if (!categories[normalizedName]) {
          // Добавляем пустую категорию, если её нет в списке из документов
          categories[normalizedName] = {
            name: normalizedName,
            pages: []
          };
        }
        // Обновляем отображаемое название
        if (cat.display_name) {
          categories[normalizedName].display_name = cat.display_name;
        }
      });
    } catch (err) {
      console.warn('[pages] Ошибка загрузки категорий из document_categories (таблица может не существовать):', err.message);
    }
    
    console.log(`[pages] GET /public/structure: создано ${Object.keys(categories).length} категорий:`, Object.keys(categories));
    
    // Сортируем страницы в категориях: сначала родительские (с детьми), потом остальные
    Object.values(categories).forEach(cat => {
      cat.pages.sort((a, b) => {
        // Сначала документы с детьми (родительские)
        const aHasChildren = a.children && Array.isArray(a.children) && a.children.length > 0;
        const bHasChildren = b.children && Array.isArray(b.children) && b.children.length > 0;
        
        // Если a имеет детей, а b нет - a идет первым (отрицательное значение = a перед b)
        if (aHasChildren && !bHasChildren) return -1;
        // Если b имеет детей, а a нет - b идет первым (положительное значение = b перед a)
        if (!aHasChildren && bHasChildren) return 1;
        
        // Если оба с детьми или оба без детей, сортируем по order_index и created_at
        if (a.order_index !== b.order_index) {
          return (a.order_index || 0) - (b.order_index || 0);
        }
        return new Date(a.created_at) - new Date(b.created_at);
      });
      
      // Логируем результат сортировки для отладки
      console.log(`[pages] Категория "${cat.name}": порядок документов:`, 
        cat.pages.map(p => ({
          id: p.id,
          title: p.title,
          hasChildren: p.children && Array.isArray(p.children) && p.children.length > 0,
          childrenCount: p.children ? p.children.length : 0
        }))
      );
    });
    
    const result = {
      categories: Object.values(categories),
      totalPages: rows.length
    };
    
    // Логируем результат для отладки
    console.log(`[pages] GET /public/structure: возвращаем ${result.categories.length} категорий`);
    result.categories.forEach(cat => {
      console.log(`  - ${cat.name}: ${cat.pages.length} страниц`);
    });
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка получения структуры страниц:', error);
    // Возвращаем пустую структуру вместо объекта с ошибкой, чтобы фронтенд не ломался
    console.error('[pages] GET /public/structure: ошибка, возвращаем пустую структуру');
    res.status(500).json({ categories: [], totalPages: 0 });
  }
});

// Получить навигацию для конкретного документа
router.get('/public/:id/navigation', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    const pageId = parseInt(req.params.id);
    
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    // Получаем текущую страницу
    const { rows: currentPage } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      WHERE id = $1 AND visibility = 'public' AND status = 'published'
    `, [pageId]);
    
    if (currentPage.length === 0) {
      return res.status(404).json({ error: 'Страница не найдена' });
    }
    
    const page = currentPage[0];
    const category = page.category || null;
    const parentId = page.parent_id || null;
    
    // Получаем все страницы той же категории/родителя для навигации
    let whereClause = `WHERE visibility = 'public' AND status = 'published'`;
    const params = [];
    let paramIndex = 1;
    
    if (parentId) {
      whereClause += ` AND parent_id = $${paramIndex}`;
      params.push(parentId);
      paramIndex++;
    } else if (category) {
      whereClause += ` AND category = $${paramIndex} AND (parent_id IS NULL OR parent_id = 0)`;
      params.push(category);
      paramIndex++;
    } else {
      whereClause += ` AND (category IS NULL OR category = '') AND (parent_id IS NULL OR parent_id = 0)`;
    }
    
    const { rows: siblings } = await db.getQuery()(`
      SELECT id, title, nav_path, order_index
      FROM ${tableName} 
      ${whereClause}
      ORDER BY COALESCE(order_index, 0) ASC, created_at ASC
    `, params);
    
    // Находим текущую страницу в списке
    const currentIndex = siblings.findIndex(p => p.id === pageId);
    const prevPage = currentIndex > 0 ? siblings[currentIndex - 1] : null;
    const nextPage = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
    
    // Получаем родительскую страницу
    let parentPage = null;
    if (parentId) {
      const { rows: parent } = await db.getQuery()(`
        SELECT id, title, nav_path FROM ${tableName} 
        WHERE id = $1 AND visibility = 'public' AND status = 'published'
      `, [parentId]);
      if (parent.length > 0) {
        parentPage = parent[0];
      }
    }
    
    // Формируем breadcrumbs
    const breadcrumbs = [];
    if (category) {
      breadcrumbs.push({ name: category, path: null });
    }
    if (parentPage) {
      breadcrumbs.push({ name: parentPage.title, path: `/content/published/${parentPage.id}` });
    }
    breadcrumbs.push({ name: page.title, path: null });
    
    res.json({
      previous: prevPage ? {
        id: prevPage.id,
        title: prevPage.title,
        path: `/content/published/${prevPage.id}`
      } : null,
      next: nextPage ? {
        id: nextPage.id,
        title: nextPage.title,
        path: `/content/published/${nextPage.id}`
      } : null,
      parent: parentPage ? {
        id: parentPage.id,
        title: parentPage.title,
        path: `/content/published/${parentPage.id}`
      } : null,
      breadcrumbs
    });
  } catch (error) {
    console.error('Ошибка получения навигации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Внутренние документы (доступны всем аутентифицированным пользователям с подключенным кошельком)
router.get('/internal/all', async (req, res) => {
  try {
    if (!req.session || !req.session.authenticated) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    if (!req.session.address) {
      return res.status(403).json({ error: 'Требуется подключение кошелька' });
    }

    const tableName = `admin_pages_simple`;
    const existsRes = await db.getQuery()( `SELECT to_regclass($1) as exists`, [tableName] );
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }

    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    
    // Все аутентифицированные пользователи с подключенным кошельком могут видеть внутренние страницы
    // EDITOR может видеть все (включая черновики), обычные пользователи - только опубликованные
    const role = userAccessLevel.level; // 'user' | 'readonly' | 'editor'
    let sql;
    if (role === 'editor') {
      // Редактор видит все внутренние страницы, включая черновики
      sql = `SELECT * FROM ${tableName} WHERE visibility = 'internal' ORDER BY created_at DESC`;
    } else {
      // Обычные пользователи видят только опубликованные внутренние страницы
      sql = `SELECT * FROM ${tableName} WHERE visibility = 'internal' AND status = 'published' ORDER BY created_at DESC`;
    }
    const { rows } = await db.getQuery()(sql);
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения внутренних страниц:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить одну опубликованную страницу по id
router.get('/public/:id', async (req, res, next) => {
  // Пропускаем специальные endpoints
  if (req.params.id === 'robots.txt' || req.params.id === 'sitemap.xml') {
    return next();
  }
  
  try {
    const tableName = `admin_pages_simple`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.status(404).json({ error: 'Страница не найдена или не опубликована' });
    }
    
    // Ищем страницу среди всех админов
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      WHERE id = $1 AND status = 'published'
    `, [req.params.id]);
    
    if (rows.length > 0) {
      return res.json(rows[0]);
    }
    
    res.status(404).json({ error: 'Страница не найдена или не опубликована' });
  } catch (error) {
    console.error('Ошибка получения публичной страницы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Endpoint для robots.txt
router.get('/public/robots.txt', async (req, res) => {
  try {
    const domain = req.get('host') || req.headers.host || 'localhost';
    const protocol = req.protocol || 'https';
    const baseUrl = `${protocol}://${domain}`;
    
    const robotsContent = `User-agent: *
Allow: /
Allow: /blog
Allow: /content/published
Disallow: /api/
Disallow: /ws
Disallow: /admin/
Disallow: /content/create
Disallow: /content/edit

Sitemap: ${baseUrl}/sitemap.xml
`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(robotsContent);
  } catch (error) {
    console.error('Ошибка генерации robots.txt:', error);
    res.status(500).send('Error generating robots.txt');
  }
});

// Endpoint для sitemap.xml
router.get('/public/sitemap.xml', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    const domain = req.get('host') || req.headers.host || 'localhost';
    const protocol = req.protocol || 'https';
    const baseUrl = `${protocol}://${domain}`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    // Генерируем XML sitemap
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/content/published</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;
    
    if (existsRes.rows[0].exists) {
      // Получаем страницы блога (с show_in_blog = true)
      const { rows: blogPages } = await db.getQuery()(`
        SELECT id, slug, updated_at, created_at 
        FROM ${tableName} 
        WHERE status = 'published' AND visibility = 'public' AND show_in_blog = TRUE
        ORDER BY created_at DESC
      `);
      
      // Добавляем страницы блога с использованием slug
      for (const page of blogPages) {
        const dateObj = page.updated_at || page.created_at || new Date();
        const lastmod = dateObj instanceof Date ? dateObj.toISOString() : String(dateObj);
        const pageUrl = page.slug 
          ? `${baseUrl}/blog/${page.slug}`
          : `${baseUrl}/blog?page=${page.id}`;
        
        sitemap += `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <lastmod>${lastmod.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
      }
      
      // Получаем остальные публичные страницы (без show_in_blog)
      const { rows: otherPages } = await db.getQuery()(`
        SELECT id, slug, updated_at, created_at 
        FROM ${tableName} 
        WHERE status = 'published' AND visibility = 'public' AND (show_in_blog IS NULL OR show_in_blog = FALSE)
        ORDER BY created_at DESC
      `);
      
      // Добавляем остальные публичные страницы с использованием slug
      for (const page of otherPages) {
        const dateObj = page.updated_at || page.created_at || new Date();
        const lastmod = dateObj instanceof Date ? dateObj.toISOString() : String(dateObj);
        const pageUrl = page.slug 
          ? `${baseUrl}/content/published/${page.slug}`
          : `${baseUrl}/content/published?page=${page.id}`;
        
        sitemap += `  <url>
    <loc>${escapeXml(pageUrl)}</loc>
    <lastmod>${lastmod.split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      }
    }
    
    sitemap += `</urlset>`;
    
    res.setHeader('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error) {
    console.error('Ошибка генерации sitemap.xml:', error);
    res.status(500).send('Error generating sitemap.xml');
  }
});

// Вспомогательная функция для экранирования XML
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Endpoint для ручного запуска pre-rendering блога
router.post('/blog/prerender', async (req, res) => {
  try {
    // Проверка прав доступа (только админ)
    if (!req.session || !req.session.authenticated || !req.session.address) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    
    const authService = require('../services/auth-service');
    const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
    
    if (!userAccessLevel.hasAccess) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    // Парсим параметры
    let { renderList = true, renderArticles = true, specificSlug = null } = req.body;
    
    // Валидация параметров
    renderList = Boolean(renderList);
    renderArticles = Boolean(renderArticles);
    
    // Валидация slug
    if (specificSlug && (typeof specificSlug !== 'string' || specificSlug.trim() === '')) {
      return res.status(400).json({ error: 'Невалидный slug' });
    }
    if (specificSlug) {
      specificSlug = specificSlug.trim();
    }
    
    console.log('[pages] POST /blog/prerender: Запуск pre-rendering...', {
      renderList,
      renderArticles,
      specificSlug: specificSlug || 'all'
    });
    
    // Запускаем pre-rendering асинхронно
    preRenderBlog({
      renderList,
      renderArticles,
      specificSlug
    }).then(() => {
      console.log('[pages] POST /blog/prerender: Pre-rendering завершен успешно');
    }).catch(err => {
      console.error('[pages] POST /blog/prerender: Ошибка pre-rendering:', err);
    });
    
    // Возвращаем ответ сразу, не дожидаясь завершения
    res.json({ 
      success: true, 
      message: 'Pre-rendering запущен. Проверьте логи для деталей.' 
    });
  } catch (error) {
    console.error('[pages] POST /blog/prerender: Ошибка:', error);
    res.status(500).json({ error: 'Ошибка запуска pre-rendering' });
  }
});

module.exports = router; 