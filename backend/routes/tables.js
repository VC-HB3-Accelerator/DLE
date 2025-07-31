/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

console.log('[DIAG][tables.js] Файл загружен:', __filename);

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const vectorSearchClient = require('../services/vectorSearchClient');
const { broadcastTableUpdate, broadcastTableRelationsUpdate } = require('../wsHub');

router.use((req, res, next) => {
  console.log('Tables router received:', req.method, req.originalUrl);
  next();
});

// Получить список всех таблиц (доступно всем)
router.get('/', async (req, res, next) => {
  try {
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const result = await db.getQuery()('SELECT id, created_at, updated_at, is_rag_source_id, decrypt_text(name_encrypted, $1) as name, decrypt_text(description_encrypted, $1) as description FROM user_tables ORDER BY id', [encryptionKey]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Создать новую таблицу (доступно всем)
router.post('/', async (req, res, next) => {
  try {
    const { name, description, isRagSourceId } = req.body;
    
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const result = await db.getQuery()(
      'INSERT INTO user_tables (name_encrypted, description_encrypted, is_rag_source_id) VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3) RETURNING *',
      [name, description || null, isRagSourceId || 2, encryptionKey]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Получить данные из таблицы is_rag_source с расшифровкой
router.get('/rag-sources', async (req, res, next) => {
  try {
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const result = await db.getQuery()(
      'SELECT id, decrypt_text(name_encrypted, $1) as name FROM is_rag_source ORDER BY id',
      [encryptionKey]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('[RAG Sources] Error:', err);
    next(err);
  }
});

// Получить структуру и данные таблицы (доступно всем)
router.get('/:id', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    // Выполняем все 4 запроса параллельно для ускорения
    const [tableMetaResult, columnsResult, rowsResult, cellValuesResult] = await Promise.all([
      // 1. Метаданные таблицы
      db.getQuery()('SELECT decrypt_text(name_encrypted, $2) as name, decrypt_text(description_encrypted, $2) as description FROM user_tables WHERE id = $1', [tableId, encryptionKey]),
      
      // 2. Столбцы
      db.getQuery()('SELECT id, table_id, "order", created_at, updated_at, decrypt_text(name_encrypted, $2) as name, decrypt_text(type_encrypted, $2) as type, decrypt_text(placeholder_encrypted, $2) as placeholder_encrypted, options, placeholder FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC', [tableId, encryptionKey]),
      
      // 3. Строки
      db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1 ORDER BY id', [tableId]),
      
      // 4. Значения ячеек
      db.getQuery()('SELECT id, row_id, column_id, created_at, updated_at, decrypt_text(value_encrypted, $2) as value FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId, encryptionKey])
    ]);

    const tableMeta = tableMetaResult.rows[0] || { name: '', description: '' };
    const columns = columnsResult.rows;
    const rows = rowsResult.rows;
    const cellValues = cellValuesResult.rows;
    
    res.json({ name: tableMeta.name, description: tableMeta.description, columns, rows, cellValues });
  } catch (err) {
    next(err);
  }
});

// Вспомогательная функция для генерации плейсхолдера
function generatePlaceholder(name, existingPlaceholders = []) {
  // Транслитерация (упрощённая)
  const cyrillicToLatinMap = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };
  let translit = name.toLowerCase().split('').map(ch => {
    if (cyrillicToLatinMap[ch]) return cyrillicToLatinMap[ch];
    if (/[a-z0-9]/.test(ch)) return ch;
    if (ch === ' ') return '_';
    if (ch === '-') return '_';
    return '';
  }).join('');
  translit = translit.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  let base = translit;
  let candidate = base;
  let i = 1;
  while (existingPlaceholders.includes(candidate)) {
    candidate = `${base}_${i}`;
    i++;
  }
  return candidate;
}

// Добавить столбец (доступно всем)
router.post('/:id/columns', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { name, type, options, order, tagIds, purpose } = req.body;
    let finalOptions = options || {};
    if (type === 'tags' && Array.isArray(tagIds)) {
      finalOptions.tagIds = tagIds;
    }
    if (purpose) {
      finalOptions.purpose = purpose;
    }
    
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    // Получаем уже существующие плейсхолдеры в таблице
    const existing = (await db.getQuery()('SELECT placeholder FROM user_columns WHERE table_id = $1', [tableId])).rows;
    const existingPlaceholders = existing.map(c => c.placeholder).filter(Boolean);
    const placeholder = generatePlaceholder(name, existingPlaceholders);
    const result = await db.getQuery()(
      'INSERT INTO user_columns (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder) VALUES ($1, encrypt_text($2, $7), encrypt_text($3, $7), encrypt_text($6, $7), $4, $5) RETURNING *',
      [tableId, name, type, order || 0, placeholder, placeholder, encryptionKey]
    );
    res.json(result.rows[0]);
    broadcastTableUpdate(tableId);
  } catch (err) {
    next(err);
  }
});

// Добавить строку (доступно всем)
router.post('/:id/rows', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const result = await db.getQuery()(
      'INSERT INTO user_rows (table_id) VALUES ($1) RETURNING *',
      [tableId]
    );
    console.log('[DEBUG][addRow] result.rows[0]:', result.rows[0]);
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    // Получаем все строки и значения для upsert
    const rows = (await db.getQuery()('SELECT r.id as row_id, decrypt_text(c.value_encrypted, $2) as text, decrypt_text(c2.value_encrypted, $2) as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.table_id = $1', [tableId, encryptionKey])).rows;
    const upsertRows = rows.filter(r => r.row_id && r.text).map(r => ({ row_id: r.row_id, text: r.text, metadata: { answer: r.answer } }));
    console.log('[DEBUG][upsertRows]', upsertRows);
    if (upsertRows.length > 0) {
      await vectorSearchClient.upsert(tableId, upsertRows);
    }
    console.log('[DEBUG][addRow] res.json:', result.rows[0]);
    res.json(result.rows[0]);
    broadcastTableUpdate(tableId);
  } catch (err) {
    next(err);
  }
});

// Получить строки таблицы с фильтрацией по продукту, тегам и связям
router.get('/:id/rows', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { product, tags, ...relationFilters } = req.query; // tags = "B2B,VIP", relation_{colId}=rowId
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    // Получаем все столбцы, строки и значения ячеек
    const columns = (await db.getQuery()('SELECT id, table_id, "order", created_at, updated_at, decrypt_text(name_encrypted, $2) as name, decrypt_text(type_encrypted, $2) as type, decrypt_text(placeholder_encrypted, $2) as placeholder_encrypted, placeholder FROM user_columns WHERE table_id = $1', [tableId, encryptionKey])).rows;
    const rows = (await db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1', [tableId])).rows;
    const cellValues = (await db.getQuery()('SELECT id, row_id, column_id, created_at, updated_at, decrypt_text(value_encrypted, $2) as value FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId, encryptionKey])).rows;

    // Находим id нужных колонок
    const productCol = columns.find(c => c.options && c.options.purpose === 'product');
    const tagsCol = columns.find(c => c.options && c.options.purpose === 'userTags');

    // Собираем строки с нужными полями
    const data = rows.map(row => {
      const cells = cellValues.filter(cell => cell.row_id === row.id);
      return {
        id: row.id,
        product: cells.find(c => c.column_id === productCol?.id)?.value,
        userTags: cells.find(c => c.column_id === tagsCol?.id)?.value,
        // ... другие поля при необходимости
      };
    });

    // Фильтрация на сервере (старое)
    let filtered = data;
    if (product) {
      filtered = filtered.filter(r => r.product === product);
    }
    if (tags) {
      const tagArr = tags.split(',').map(t => t.trim());
      filtered = filtered.filter(r =>
        tagArr.some(tag => (r.userTags || '').split(',').map(t => t.trim()).includes(tag))
      );
    }

    // Новая фильтрация по relation/multiselect/lookup
    const relationFilterKeys = Object.keys(relationFilters).filter(k => k.startsWith('relation_') || k.startsWith('multiselect_') || k.startsWith('lookup_'));
    if (relationFilterKeys.length > 0) {
      // Получаем все связи для строк этой таблицы
      const rowIds = filtered.map(r => r.id);
      const rels = (await db.getQuery()(
        'SELECT * FROM user_table_relations WHERE from_row_id = ANY($1)', [rowIds]
      )).rows;
      for (const key of relationFilterKeys) {
        const [type, colId] = key.split('_');
        const filterVals = (relationFilters[key] || '').split(',').map(v => v.trim()).filter(Boolean);
        if (!colId || !filterVals.length) continue;
        filtered = filtered.filter(r => {
          const relsForRow = rels.filter(rel => String(rel.from_row_id) === String(r.id) && String(rel.column_id) === colId);
          if (type === 'relation' || type === 'lookup') {
            // Обычная связь: хотя бы одна связь с нужным to_row_id
            return relsForRow.some(rel => filterVals.includes(String(rel.to_row_id)));
          } else if (type === 'multiselect') {
            // Мультивыбор: все значения должны быть среди связей
            const rowVals = relsForRow.map(rel => String(rel.to_row_id));
            return filterVals.every(val => rowVals.includes(val));
          }
          return true;
        });
      }
    }

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});



// Создать/обновить значение ячейки (upsert) (доступно всем)
router.post('/cell', async (req, res, next) => {
  try {
    const { row_id, column_id, value } = req.body;
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const result = await db.getQuery()(
      `INSERT INTO user_cell_values (row_id, column_id, value_encrypted) VALUES ($1, $2, encrypt_text($3, $4))
       ON CONFLICT (row_id, column_id) DO UPDATE SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()
       RETURNING *`,
      [row_id, column_id, value, encryptionKey]
    );
    
    // Получаем table_id и проверяем, является ли это таблицей тегов
    const table = (await db.getQuery()('SELECT table_id FROM user_rows WHERE id = $1', [row_id])).rows[0];
    if (table) {
      const tableId = table.table_id;
      
      // Проверяем, является ли это таблицей "Теги клиентов"
      const tableName = (await db.getQuery()('SELECT decrypt_text(name_encrypted, $2) as name FROM user_tables WHERE id = $1', [tableId, encryptionKey])).rows[0];
      console.log('🔄 [Tables] Проверяем таблицу:', { tableId, tableName: tableName?.name });
      if (tableName && tableName.name === 'Теги клиентов') {
        // Отправляем WebSocket уведомление об обновлении тегов
        console.log('🔄 [Tables] Обновление ячейки в таблице тегов, отправляем уведомление');
        const { broadcastTagsUpdate } = require('../wsHub');
        broadcastTagsUpdate();
      }
      
      // Получаем всю строку для upsert
      const rowData = (await db.getQuery()('SELECT r.id as row_id, decrypt_text(c.value_encrypted, $2) as text, decrypt_text(c2.value_encrypted, $2) as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.id = $1', [row_id, encryptionKey])).rows[0];
      if (rowData) {
        const upsertRows = [{ row_id: rowData.row_id, text: rowData.text, metadata: { answer: rowData.answer } }].filter(r => r.row_id && r.text);
        console.log('[DEBUG][upsertRows]', upsertRows);
        if (upsertRows.length > 0) {
          await vectorSearchClient.upsert(tableId, upsertRows);
        }
      }
      
      // Отправляем WebSocket уведомление об обновлении таблицы
      const { broadcastTableUpdate } = require('../wsHub');
      broadcastTableUpdate(tableId);
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Удалить строку (доступно всем)
router.delete('/row/:rowId', async (req, res, next) => {
  try {
    const rowId = req.params.rowId;
    // Получаем table_id
    const table = (await db.getQuery()('SELECT table_id FROM user_rows WHERE id = $1', [rowId])).rows[0];
    
    // Проверяем, является ли это таблицей тегов перед удалением
    let isTagsTable = false;
    if (table) {
      const fs = require('fs');
      const path = require('path');
      let encryptionKey = 'default-key';
      
      try {
        const keyPath = '/app/ssl/keys/full_db_encryption.key';
        if (fs.existsSync(keyPath)) {
          encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
        }
      } catch (keyError) {
        console.error('Error reading encryption key:', keyError);
      }
      
      const tableName = (await db.getQuery()('SELECT decrypt_text(name_encrypted, $2) as name FROM user_tables WHERE id = $1', [table.table_id, encryptionKey])).rows[0];
      isTagsTable = tableName && tableName.name === 'Теги клиентов';
    }
    
    await db.getQuery()('DELETE FROM user_rows WHERE id = $1', [rowId]);
    
    if (table) {
      const tableId = table.table_id;
      // Получаем все строки для rebuild
      // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const rows = (await db.getQuery()('SELECT r.id as row_id, decrypt_text(c.value_encrypted, $2) as text, decrypt_text(c2.value_encrypted, $2) as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.table_id = $1', [tableId, encryptionKey])).rows;
      const rebuildRows = rows.filter(r => r.row_id && r.text).map(r => ({ row_id: r.row_id, text: r.text, metadata: { answer: r.answer } }));
      console.log('[DEBUG][rebuildRows]', rebuildRows);
      if (rebuildRows.length > 0) {
        await vectorSearchClient.rebuild(tableId, rebuildRows);
      }
    }
    
    // Отправляем WebSocket уведомление, если это была таблица тегов
    if (isTagsTable) {
      console.log('🔄 [Tables] Обновление строки в таблице тегов, отправляем уведомление');
      const { broadcastTagsUpdate } = require('../wsHub');
      broadcastTagsUpdate();
    }
    
    // Отправляем WebSocket уведомление об обновлении таблицы
    const { broadcastTableUpdate } = require('../wsHub');
    broadcastTableUpdate(tableId);
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Удалить столбец (доступно всем)
router.delete('/column/:columnId', async (req, res, next) => {
  try {
    const columnId = req.params.columnId;
    await db.getQuery()('DELETE FROM user_columns WHERE id = $1', [columnId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PATCH для обновления столбца (доступно всем)
router.patch('/column/:columnId', async (req, res, next) => {
  try {
    const columnId = req.params.columnId;
    const { name, type, options, order, placeholder } = req.body;
    // Получаем table_id для проверки уникальности плейсхолдера
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const colInfo = (await db.getQuery()('SELECT table_id, decrypt_text(name_encrypted, $2) as name FROM user_columns WHERE id = $1', [columnId, encryptionKey])).rows[0];
    if (!colInfo) return res.status(404).json({ error: 'Column not found' });
    let newPlaceholder = placeholder;
    if (name !== undefined && !placeholder) {
      // Если имя меняется и плейсхолдер не передан — генерируем новый
      const existing = (await db.getQuery()('SELECT placeholder FROM user_columns WHERE table_id = $1 AND id != $2', [colInfo.table_id, columnId])).rows;
      const existingPlaceholders = existing.map(c => c.placeholder).filter(Boolean);
      newPlaceholder = generatePlaceholder(name, existingPlaceholders);
    }
    // Построение динамического запроса
    const updates = [];
    const values = [];
    let paramIndex = 1;
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (options !== undefined) {
      updates.push(`options = $${paramIndex++}`);
      values.push(options ? JSON.stringify(options) : null);
    }
    if (order !== undefined) {
      updates.push(`"order" = $${paramIndex++}`);
      values.push(order);
    }
    if (newPlaceholder !== undefined) {
      updates.push(`placeholder = $${paramIndex++}`);
      values.push(newPlaceholder);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    updates.push(`updated_at = NOW()`);
    values.push(columnId);
    const query = `UPDATE user_columns SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await db.getQuery()(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Column not found' });
    }
    res.json(result.rows[0]);
    broadcastTableUpdate(colInfo.table_id);
  } catch (err) {
    next(err);
  }
});

// PATCH: обновить название/описание таблицы (доступно всем)
router.patch('/:id', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { name, description, isRagSourceId } = req.body;
    const result = await db.getQuery()(
      `UPDATE user_tables SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_rag_source_id = COALESCE($3, is_rag_source_id),
        updated_at = NOW()
      WHERE id = $4 RETURNING *`,
      [name, description, isRagSourceId, tableId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH: массовое обновление порядка строк (order)
router.patch('/:id/rows/order', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { order } = req.body; // order: [{rowId, order}, ...]
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order должен быть массивом' });
    }
    for (const item of order) {
      if (!item.rowId || typeof item.order !== 'number') continue;
      await db.getQuery()(
        'UPDATE user_rows SET "order" = $1, updated_at = NOW() WHERE id = $2 AND table_id = $3',
        [item.order, item.rowId, tableId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Получить id колонок с purpose 'question' и 'answer'
async function getQuestionAnswerColumnIds(tableId) {
  const { rows } = await db.getQuery()(
    `SELECT id, options FROM user_columns WHERE table_id = $1`, [tableId]
  );
  let questionCol = null, answerCol = null;
  for (const col of rows) {
    if (col.options && col.options.purpose === 'question') questionCol = col.id;
    if (col.options && col.options.purpose === 'answer') answerCol = col.id;
  }
  return { questionCol, answerCol };
}

// Пересобрать векторный индекс для таблицы (только для админа)
router.post('/:id/rebuild-index', requireAuth, async (req, res, next) => {
  try {
    if (!req.session.isAdmin) {
      return res.status(403).json({ error: 'Доступ только для администратора' });
    }
    
    // Получаем ключ шифрования
    const fs = require('fs');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const tableId = req.params.id;
    const { questionCol, answerCol } = await getQuestionAnswerColumnIds(tableId);
    if (!questionCol || !answerCol) {
      return res.status(400).json({ error: 'Не найдены колонки с вопросами и ответами' });
    }
    
    const rows = (await db.getQuery()(
      `SELECT r.id as row_id, 
              decrypt_text(c.value_encrypted, $4) as text, 
              decrypt_text(c2.value_encrypted, $4) as answer
       FROM user_rows r
       LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = $2
       LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = $3
       WHERE r.table_id = $1`,
      [tableId, questionCol, answerCol, encryptionKey]
    )).rows;
    
    const rebuildRows = rows.filter(r => r.row_id && r.text).map(r => ({ 
      row_id: r.row_id, 
      text: r.text, 
      metadata: { answer: r.answer } 
    }));
    
    console.log('[DEBUG][rebuildRows]', rebuildRows);
    
    if (rebuildRows.length > 0) {
      await vectorSearchClient.rebuild(tableId, rebuildRows);
      res.json({ success: true, count: rebuildRows.length });
    } else {
      res.status(400).json({ error: 'Нет валидных строк для индексации' });
    }
  } catch (err) {
    next(err);
  }
});

// DELETE: удалить таблицу и каскадно все связанные строки/столбцы/ячейки (доступно всем)
router.delete('/:id', requireAuth, async (req, res, next) => {
  const dbModule = require('../db');
  try {
    // Логируем строку подключения и pool.options
    console.log('[DIAG][DELETE] pool.options:', dbModule.pool.options);
    console.log('[DIAG][DELETE] process.env.DATABASE_URL:', process.env.DATABASE_URL);
    console.log('[DIAG][DELETE] process.env.DB_HOST:', process.env.DB_HOST);
    console.log('[DIAG][DELETE] process.env.DB_NAME:', process.env.DB_NAME);
    console.log('=== [DIAG] Попытка удаления таблицы ===');
    console.log('Сессия пользователя:', req.session);
    if (!req.session.isAdmin) {
      console.log('[DIAG] Нет прав администратора');
      return res.status(403).json({ error: 'Удаление доступно только администраторам' });
    }
    const tableId = Number(req.params.id);
    console.log('[DIAG] id из запроса:', req.params.id, 'Преобразованный id:', tableId, 'typeof:', typeof tableId);

    // Проверяем наличие таблицы перед удалением
    const checkBefore = await db.getQuery()('SELECT * FROM user_tables WHERE id = $1', [tableId]);
    console.log('[DIAG] Таблица перед удалением:', checkBefore.rows);

    // Пытаемся удалить
    const result = await db.getQuery()('DELETE FROM user_tables WHERE id = $1 RETURNING *', [tableId]);
    console.log('[DIAG] Результат удаления (rowCount):', result.rowCount, 'rows:', result.rows);

    // Проверяем наличие таблицы после удаления
    const checkAfter = await db.getQuery()('SELECT * FROM user_tables WHERE id = $1', [tableId]);
    console.log('[DIAG] Таблица после удаления:', checkAfter.rows);

    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('[DIAG] Ошибка при удалении таблицы:', err);
    next(err);
  }
});

// Получить связи для строки (relation/multiselect/lookup)
router.get('/:tableId/row/:rowId/relations', async (req, res, next) => {
  try {
    const { tableId, rowId } = req.params;
    const relations = (await db.getQuery()(
      'SELECT * FROM user_table_relations WHERE from_row_id = $1',
      [rowId]
    )).rows;
    res.json(relations);
  } catch (err) {
    next(err);
  }
});

// Добавить связь (relation/multiselect/lookup)
router.post('/:tableId/row/:rowId/relations', async (req, res, next) => {
  try {
    const { tableId, rowId } = req.params;
    const { column_id, to_table_id, to_row_id } = req.body;
    const result = await db.getQuery()(
      `INSERT INTO user_table_relations (from_row_id, column_id, to_table_id, to_row_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [rowId, column_id, to_table_id, to_row_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Удалить связь
router.delete('/:tableId/row/:rowId/relations/:relationId', async (req, res, next) => {
  try {
    const { relationId } = req.params;
    await db.getQuery()('DELETE FROM user_table_relations WHERE id = $1', [relationId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// --- Массовое обновление связей для multiselect-relation ---
router.post('/:tableId/row/:rowId/multirelations', async (req, res, next) => {
  try {
    const { tableId, rowId } = req.params;
    const { column_id, to_table_id, to_row_ids } = req.body; // to_row_ids: массив id
    if (!Array.isArray(to_row_ids)) return res.status(400).json({ error: 'to_row_ids должен быть массивом' });
    
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    // Проверяем, является ли это обновлением тегов (проверяем связанную таблицу)
    const relatedTableName = (await db.getQuery()('SELECT decrypt_text(name_encrypted, $2) as name FROM user_tables WHERE id = $1', [to_table_id, encryptionKey])).rows[0];
    console.log('🔄 [Tables] Multirelations: проверяем связанную таблицу:', { to_table_id, tableName: relatedTableName?.name });
    
    if (relatedTableName && relatedTableName.name === 'Теги клиентов') {
      console.log('🔄 [Tables] Multirelations: обновление тегов, отправляем уведомление');
      const { broadcastTagsUpdate } = require('../wsHub');
      broadcastTagsUpdate();
    }
    
    // Удаляем старые связи для этой строки/столбца
    await db.getQuery()('DELETE FROM user_table_relations WHERE from_row_id = $1 AND column_id = $2', [rowId, column_id]);
    // Добавляем новые связи
    for (const to_row_id of to_row_ids) {
      await db.getQuery()(
        `INSERT INTO user_table_relations (from_row_id, column_id, to_table_id, to_row_id)
         VALUES ($1, $2, $3, $4)`,
        [rowId, column_id, to_table_id, to_row_id]
      );
    }
    
    // Отправляем WebSocket уведомление об обновлении связей
    broadcastTableRelationsUpdate(tableId, rowId);
    
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Получить плейсхолдеры для всех столбцов таблицы
router.get('/:id/placeholders', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const columns = (await db.getQuery()('SELECT id, decrypt_text(name_encrypted, $2) as name, placeholder FROM user_columns WHERE table_id = $1', [tableId, encryptionKey])).rows;
    res.json(columns.map(col => ({
      id: col.id,
      name: col.name,
      placeholder: col.placeholder
    })));
  } catch (err) {
    next(err);
  }
});

// Получить все плейсхолдеры по всем пользовательским таблицам
router.get('/placeholders/all', async (req, res, next) => {
  try {
    const encryptedDb = require('../services/encryptedDatabaseService');
    
    // Получаем все колонки с плейсхолдерами
    const columns = await encryptedDb.getData('user_columns', {});
    
    // Фильтруем только те, у которых есть плейсхолдеры
    const columnsWithPlaceholders = columns.filter(col => col.placeholder && col.placeholder !== '');
    
    // Получаем информацию о таблицах
    const tables = await encryptedDb.getData('user_tables', {});
    const tableMap = {};
    tables.forEach(table => {
      tableMap[table.id] = table.name;
    });
    
    // Формируем результат
    const result = columnsWithPlaceholders.map(col => ({
      column_id: col.id,
      column_name: col.name,
      placeholder: col.placeholder,
      table_id: col.table_id,
      table_name: tableMap[col.table_id] || `Таблица ${col.table_id}`
    }));
    
    res.json(result);
  } catch (err) {
    console.error('[Placeholders] Error:', err);
    next(err);
  }
});

module.exports = router;