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
    checksum: bodyRaw.checksum || null
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
  for (const [k, v] of Object.entries(incoming)) {
    if (FIELDS_TO_EXCLUDE.includes(k)) continue;
    updateData[k] = typeof v === 'object' ? JSON.stringify(v) : v;
  }
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
  const { rows } = await db.getQuery()(sql, values);
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  const updated = rows[0];

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
    
    // Получаем все опубликованные страницы всех админов
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      WHERE status = 'published' 
      ORDER BY created_at DESC
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения публичных страниц:', error);
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