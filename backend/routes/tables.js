console.log('[DIAG][tables.js] Файл загружен:', __filename);

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const vectorSearchClient = require('../services/vectorSearchClient');

router.use((req, res, next) => {
  console.log('Tables router received:', req.method, req.originalUrl);
  next();
});

// Получить список всех таблиц (доступно всем)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.getQuery()('SELECT * FROM user_tables ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Создать новую таблицу (доступно всем)
router.post('/', async (req, res, next) => {
  try {
    const { name, description, isRagSourceId } = req.body;
    const result = await db.getQuery()(
      'INSERT INTO user_tables (name, description, is_rag_source_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, isRagSourceId || 2]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Получить структуру и данные таблицы (доступно всем)
router.get('/:id', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const tableMetaResult = await db.getQuery()('SELECT name, description FROM user_tables WHERE id = $1', [tableId]);
    const tableMeta = tableMetaResult.rows[0] || { name: '', description: '' };
    const columns = (await db.getQuery()('SELECT * FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC', [tableId])).rows;
    const rows = (await db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1 ORDER BY id', [tableId])).rows;
    const cellValues = (await db.getQuery()('SELECT * FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId])).rows;
    res.json({ name: tableMeta.name, description: tableMeta.description, columns, rows, cellValues });
  } catch (err) {
    next(err);
  }
});

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
    const result = await db.getQuery()(
      'INSERT INTO user_columns (table_id, name, type, options, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tableId, name, type, finalOptions ? JSON.stringify(finalOptions) : null, order || 0]
    );
    res.json(result.rows[0]);
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
    // Получаем все строки и значения для upsert
    const rows = (await db.getQuery()('SELECT r.id as row_id, c.value as text, c2.value as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.table_id = $1', [tableId])).rows;
    const upsertRows = rows.filter(r => r.row_id && r.text).map(r => ({ row_id: r.row_id, text: r.text, metadata: { answer: r.answer } }));
    console.log('[DEBUG][upsertRows]', upsertRows);
    if (upsertRows.length > 0) {
      await vectorSearchClient.upsert(tableId, upsertRows);
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Получить строки таблицы с фильтрацией по продукту и тегам
router.get('/:id/rows', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { product, tags } = req.query; // tags = "B2B,VIP"
    // Получаем все столбцы, строки и значения ячеек
    const columns = (await db.getQuery()('SELECT * FROM user_columns WHERE table_id = $1', [tableId])).rows;
    const rows = (await db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1', [tableId])).rows;
    const cellValues = (await db.getQuery()('SELECT * FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId])).rows;

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

    // Фильтрация на сервере
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

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// Изменить значение ячейки (доступно всем)
router.patch('/cell/:cellId', async (req, res, next) => {
  try {
    const cellId = req.params.cellId;
    const { value } = req.body;
    const result = await db.getQuery()(
      'UPDATE user_cell_values SET value = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [value, cellId]
    );
    // Получаем row_id и table_id
    const row = (await db.getQuery()('SELECT row_id FROM user_cell_values WHERE id = $1', [cellId])).rows[0];
    if (row) {
      const rowId = row.row_id;
      const table = (await db.getQuery()('SELECT table_id FROM user_rows WHERE id = $1', [rowId])).rows[0];
      if (table) {
        const tableId = table.table_id;
        // Получаем всю строку для upsert
        const rowData = (await db.getQuery()('SELECT r.id as row_id, c.value as text, c2.value as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.id = $1', [rowId])).rows[0];
        if (rowData) {
          const upsertRows = [{ row_id: rowData.row_id, text: rowData.text, metadata: { answer: rowData.answer } }].filter(r => r.row_id && r.text);
          console.log('[DEBUG][upsertRows]', upsertRows);
          if (upsertRows.length > 0) {
            await vectorSearchClient.upsert(tableId, upsertRows);
          }
        }
      }
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Создать/обновить значение ячейки (upsert) (доступно всем)
router.post('/cell', async (req, res, next) => {
  try {
    const { row_id, column_id, value } = req.body;
    const result = await db.getQuery()(
      `INSERT INTO user_cell_values (row_id, column_id, value) VALUES ($1, $2, $3)
       ON CONFLICT (row_id, column_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING *`,
      [row_id, column_id, value]
    );
    // Получаем table_id
    const table = (await db.getQuery()('SELECT table_id FROM user_rows WHERE id = $1', [row_id])).rows[0];
    if (table) {
      const tableId = table.table_id;
      // Получаем всю строку для upsert
      const rowData = (await db.getQuery()('SELECT r.id as row_id, c.value as text, c2.value as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.id = $1', [row_id])).rows[0];
      if (rowData) {
        const upsertRows = [{ row_id: rowData.row_id, text: rowData.text, metadata: { answer: rowData.answer } }].filter(r => r.row_id && r.text);
        console.log('[DEBUG][upsertRows]', upsertRows);
        if (upsertRows.length > 0) {
          await vectorSearchClient.upsert(tableId, upsertRows);
        }
      }
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
    await db.getQuery()('DELETE FROM user_rows WHERE id = $1', [rowId]);
    if (table) {
      const tableId = table.table_id;
      // Получаем все строки для rebuild
      const rows = (await db.getQuery()('SELECT r.id as row_id, c.value as text, c2.value as answer FROM user_rows r LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = 1 LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = 2 WHERE r.table_id = $1', [tableId])).rows;
      const rebuildRows = rows.filter(r => r.row_id && r.text).map(r => ({ row_id: r.row_id, text: r.text, metadata: { answer: r.answer } }));
      console.log('[DEBUG][rebuildRows]', rebuildRows);
      if (rebuildRows.length > 0) {
        await vectorSearchClient.rebuild(tableId, rebuildRows);
      }
    }
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
    const { name, type, options, order } = req.body;
    
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
    const tableId = req.params.id;
    const { questionCol, answerCol } = await getQuestionAnswerColumnIds(tableId);
    if (!questionCol || !answerCol) {
      return res.status(400).json({ error: 'Не найдены колонки с вопросами и ответами' });
    }
    const rows = (await db.getQuery()(
      `SELECT r.id as row_id, c.value as text, c2.value as answer
       FROM user_rows r
       LEFT JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = $2
       LEFT JOIN user_cell_values c2 ON c2.row_id = r.id AND c2.column_id = $3
       WHERE r.table_id = $1`,
      [tableId, questionCol, answerCol]
    )).rows;
    const rebuildRows = rows.filter(r => r.row_id && r.text).map(r => ({ row_id: r.row_id, text: r.text, metadata: { answer: r.answer } }));
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

module.exports = router;