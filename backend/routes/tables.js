const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

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
    const { name, description } = req.body;
    const result = await db.getQuery()(
      'INSERT INTO user_tables (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
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
    const columns = (await db.getQuery()('SELECT * FROM user_columns WHERE table_id = $1 ORDER BY "order" ASC, id ASC', [tableId])).rows;
    const rows = (await db.getQuery()('SELECT * FROM user_rows WHERE table_id = $1 ORDER BY id', [tableId])).rows;
    const cellValues = (await db.getQuery()('SELECT * FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId])).rows;
    res.json({ columns, rows, cellValues });
  } catch (err) {
    next(err);
  }
});

// Добавить столбец (доступно всем)
router.post('/:id/columns', async (req, res, next) => {
  try {
    const tableId = req.params.id;
    const { name, type, options, order } = req.body;
    const result = await db.getQuery()(
      'INSERT INTO user_columns (table_id, name, type, options, "order") VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tableId, name, type, options ? JSON.stringify(options) : null, order || 0]
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
    res.json(result.rows[0]);
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
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Удалить строку (доступно всем)
router.delete('/row/:rowId', async (req, res, next) => {
  try {
    const rowId = req.params.rowId;
    await db.getQuery()('DELETE FROM user_rows WHERE id = $1', [rowId]);
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
    const { name, description } = req.body;
    const result = await db.getQuery()(
      `UPDATE user_tables SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        updated_at = NOW()
      WHERE id = $3 RETURNING *`,
      [name, description, tableId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE: удалить таблицу и каскадно все связанные строки/столбцы/ячейки (доступно всем)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const tableId = Number(req.params.id);
    console.log('Backend: typeof tableId:', typeof tableId, 'value:', tableId);
    // Проверяем, существует ли таблица
    const checkResult = await db.getQuery()('SELECT id, name FROM user_tables WHERE id = $1', [tableId]);
    console.log('Backend: Table check result:', checkResult.rows);
    if (checkResult.rows.length === 0) {
      console.log('Backend: Table not found');
      return res.status(404).json({ error: 'Table not found' });
    }
    // Удаляем только основную таблицу - каскадное удаление сработает автоматически
    console.log('Backend: Executing DELETE query for table_id:', tableId);
    const result = await db.getQuery()('DELETE FROM user_tables WHERE id = $1', [tableId]);
    console.log('Backend: Delete result - rowCount:', result.rowCount);
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    console.error('Backend: Error deleting table:', err);
    next(err);
  }
});

module.exports = router;