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
      'updated_at TIMESTAMP DEFAULT NOW()'
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

// Создать страницу (только для админа)
router.post('/', upload.single('file'), async (req, res) => {
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
    return res.status(403).json({ error: 'Only admin can create pages' });
  }
  
  const authorAddress = req.session.address;
  const tableName = `admin_pages_simple`;

  // Собираем данные страницы
  const bodyRaw = req.body || {};
  const pageData = {
    title: bodyRaw.title || '',
    summary: bodyRaw.summary || '',
    content: bodyRaw.content || '',
    seo: bodyRaw.seo ? (typeof bodyRaw.seo === 'string' ? bodyRaw.seo : JSON.stringify(bodyRaw.seo)) : null,
    status: bodyRaw.status || 'draft',
    settings: bodyRaw.settings ? (typeof bodyRaw.settings === 'string' ? bodyRaw.settings : JSON.stringify(bodyRaw.settings)) : null,
    visibility: bodyRaw.visibility || 'public',
    required_permission: bodyRaw.required_permission || null,
    format: bodyRaw.format || (req.file ? (req.file.mimetype?.startsWith('image/') ? 'image' : 'pdf') : 'html'),
    mime_type: req.file ? (req.file.mimetype || null) : (bodyRaw.mime_type || (bodyRaw.format === 'html' ? 'text/html' : null)),
    storage_type: req.file ? 'file' : (bodyRaw.storage_type || 'embedded'),
    file_path: req.file ? path.join('/uploads', 'legal', path.basename(req.file.path)) : (bodyRaw.file_path || null),
    size_bytes: req.file ? req.file.size : (bodyRaw.size_bytes || null),
    checksum: bodyRaw.checksum || null,
    // Нормализуем категорию: приводим к нижнему регистру для консистентности
    category: (bodyRaw.category && String(bodyRaw.category).trim()) ? String(bodyRaw.category).trim().toLowerCase() : null,
    // Обрабатываем parent_id: может быть null или числом
    parent_id: (bodyRaw.parent_id && bodyRaw.parent_id !== 'null' && bodyRaw.parent_id !== '') 
      ? (() => { const parsed = parseInt(bodyRaw.parent_id); return isNaN(parsed) ? null : parsed; })()
      : null,
    // Обрабатываем order_index: должно быть числом
    order_index: (bodyRaw.order_index && bodyRaw.order_index !== 'null' && bodyRaw.order_index !== '') 
      ? (() => { const parsed = parseInt(bodyRaw.order_index); return isNaN(parsed) ? 0 : parsed; })()
      : 0,
    nav_path: bodyRaw.nav_path || null,
    is_index_page: bodyRaw.is_index_page === true || bodyRaw.is_index_page === 'true'
  };

  // Формируем SQL для вставки данных (только непустые поля)
  const dataEntries = Object.entries(pageData).filter(([, v]) => v !== undefined);
  const colNames = ['author_address', ...dataEntries.map(([k]) => k)].join(', ');
  const values = [authorAddress, ...dataEntries.map(([, v]) => v)];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await db.getQuery()(sql, values);
  const created = rows[0];

  // Индексация выполняется ТОЛЬКО вручную через кнопку "Индекс" (POST /:id/reindex)
  // Автоматическая индексация при создании отключена

  res.json(created);
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

// Получить одну страницу по id (только для админа)
router.get('/:id', async (req, res) => {
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
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const { rows } = await db.getQuery()(
    `SELECT * FROM ${tableName} WHERE id = $1`, 
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
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
    return res.status(403).json({ error: 'Only admin can edit pages' });
  }
  
  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const incoming = req.body || {};
  const updateData = {};
  
  console.log(`[pages] PATCH /:id (${req.params.id}): получены данные для обновления:`, incoming);
  
  for (const [k, v] of Object.entries(incoming)) {
    if (FIELDS_TO_EXCLUDE.includes(k)) continue;
    
    // Нормализуем категорию: приводим к нижнему регистру для консистентности
    if (k === 'category') {
      updateData[k] = (v && String(v).trim()) ? String(v).trim().toLowerCase() : null;
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
    // Остальные поля
    else {
      updateData[k] = typeof v === 'object' ? JSON.stringify(v) : v;
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
  
  const { rows } = await db.getQuery()(sql, values);
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  const updated = rows[0];
  
  console.log(`[pages] PATCH /:id (${req.params.id}): страница успешно обновлена:`, {
    id: updated.id,
    title: updated.title,
    category: updated.category,
    parent_id: updated.parent_id,
    order_index: updated.order_index,
    is_index_page: updated.is_index_page
  });

  // Индексация выполняется ТОЛЬКО вручную через кнопку "Индекс" (POST /:id/reindex)
  // Автоматическая индексация при обновлении отключена

  res.json(updated);
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
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const { rows } = await db.getQuery()(
    `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, 
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  const deleted = rows[0];
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

// Внутренние документы (доступны аутентифицированным пользователям с доступом)
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
    if (!userAccessLevel.hasAccess) {
      return res.status(403).json({ error: 'Only internal users can view pages' });
    }

    // READONLY/EDITOR видят внутренние опубликованные; EDITOR может видеть и черновики
    const role = userAccessLevel.level; // 'readonly' | 'editor'
    let sql;
    if (role === 'editor') {
      sql = `SELECT * FROM ${tableName} WHERE visibility = 'internal' ORDER BY created_at DESC`;
    } else {
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
router.get('/public/:id', async (req, res) => {
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

module.exports = router; 