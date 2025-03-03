const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware для проверки аутентификации
function requireAuth(req, res, next) {
  if (!req.session || (!req.session.isAuthenticated && !req.session.authenticated)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Получение всех досок пользователя
router.get('/boards', async (req, res) => {
  try {
    // Для разработки: если сессия не содержит адрес, используем тестовый
    const userAddress = (req.session.address || '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b').toLowerCase();
    
    console.log('Запрос досок для адреса:', userAddress);
    
    // Проверяем, существует ли пользователь
    const userResult = await pool.query(
      'SELECT id FROM users WHERE address = $1',
      [userAddress]
    );
    
    console.log('Результат запроса пользователя:', userResult.rows);
    
    if (userResult.rows.length === 0) {
      console.log('Пользователь не найден, создаем нового');
      // Если пользователь не найден, создаем его
      const newUserResult = await pool.query(
        'INSERT INTO users (address, created_at) VALUES ($1, NOW()) RETURNING id',
        [userAddress]
      );
      console.log('Создан новый пользователь:', newUserResult.rows);
    }
    
    // Получаем доски пользователя
    const ownBoardsQuery = 'SELECT kb.* FROM kanban_boards kb ' +
      'JOIN users u ON kb.owner_id = u.id ' +
      'WHERE u.address = $1 ' +
      'ORDER BY kb.updated_at DESC';
    
    console.log('Запрос досок пользователя:', ownBoardsQuery);
    
    const ownBoardsResult = await pool.query(ownBoardsQuery, [userAddress]);
    
    console.log('Результат запроса досок пользователя:', ownBoardsResult.rows);
    
    // Получаем доски, к которым у пользователя есть доступ
    const sharedBoardsResult = await pool.query(
      'SELECT kb.* FROM kanban_boards kb ' +
      'JOIN kanban_board_access kba ON kb.id = kba.board_id ' +
      'JOIN users u1 ON kba.user_id = u1.id ' +
      'JOIN users u2 ON kb.owner_id = u2.id ' +
      'WHERE u1.address = $1 AND u2.address != $1 ' +
      'ORDER BY kb.updated_at DESC',
      [userAddress]
    );
    
    // Получаем публичные доски
    const publicBoardsResult = await pool.query(
      'SELECT kb.* FROM kanban_boards kb ' +
      'JOIN users u ON kb.owner_id = u.id ' +
      'WHERE kb.is_public = true AND u.address != $1 ' +
      'AND NOT EXISTS (' +
      '  SELECT 1 FROM kanban_board_access kba ' +
      '  JOIN users u2 ON kba.user_id = u2.id ' +
      '  WHERE kba.board_id = kb.id AND u2.address = $1' +
      ') ' +
      'ORDER BY kb.updated_at DESC',
      [userAddress]
    );
    
    res.json({
      ownBoards: ownBoardsResult.rows,
      sharedBoards: sharedBoardsResult.rows,
      publicBoards: publicBoardsResult.rows
    });
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание новой доски
router.post('/boards', requireAuth, async (req, res) => {
  try {
    const { title, description, isPublic } = req.body;
    
    // Получаем ID пользователя
    let userResult = await pool.query(
      'SELECT id FROM users WHERE address = $1',
      [req.session.address]
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // Если пользователь не найден, создаем его
      const newUserResult = await pool.query(
        'INSERT INTO users (address, created_at, preferred_language) VALUES ($1, NOW(), $2) RETURNING id',
        [req.session.address, 'ru']
      );
      
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }
    
    // Создаем новую доску
    const result = await pool.query(
      `INSERT INTO kanban_boards (title, description, owner_id, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [title, description, userId, isPublic]
    );
    
    // Создаем стандартные колонки
    const columns = ['Backlog', 'In Progress', 'Review', 'Done'];
    for (let i = 0; i < columns.length; i++) {
      await pool.query(
        `INSERT INTO kanban_columns (board_id, title, position, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())`,
        [result.rows[0].id, columns[i], i]
      );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating kanban board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение конкретной доски со всеми колонками и карточками
router.get('/boards/:id', requireAuth, async (req, res) => {
  try {
    const boardId = req.params.id;
    
    // Получаем ID пользователя
    let userResult = await pool.query(
      'SELECT id FROM users WHERE address = $1',
      [req.session.address]
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // Если пользователь не найден, создаем его
      const newUserResult = await pool.query(
        'INSERT INTO users (address, created_at, preferred_language) VALUES ($1, NOW(), $2) RETURNING id',
        [req.session.address, 'ru']
      );
      
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }
    
    // Проверяем доступ к доске
    const boardResult = await pool.query(
      'SELECT * FROM kanban_boards WHERE id = $1',
      [boardId]
    );
    
    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    const board = boardResult.rows[0];
    
    // Проверяем, имеет ли пользователь доступ к доске
    if (board.owner_id !== userId && !board.is_public) {
      const accessResult = await pool.query(
        'SELECT * FROM kanban_board_access WHERE board_id = $1 AND user_id = $2',
        [boardId, userId]
      );
      
      if (accessResult.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    // Получаем колонки доски
    const columnsResult = await pool.query(
      'SELECT * FROM kanban_columns WHERE board_id = $1 ORDER BY position',
      [boardId]
    );
    
    // Получаем карточки для всех колонок
    const cardsResult = await pool.query(
      `SELECT kc.*, u.address as assigned_address 
       FROM kanban_cards kc
       LEFT JOIN users u ON kc.assigned_to = u.id
       WHERE kc.column_id IN (
         SELECT id FROM kanban_columns WHERE board_id = $1
       )
       ORDER BY kc.position`,
      [boardId]
    );
    
    // Группируем карточки по колонкам
    const columns = columnsResult.rows.map(column => {
      const cards = cardsResult.rows.filter(card => card.column_id === column.id);
      return {
        ...column,
        cards
      };
    });
    
    res.json({
      ...board,
      columns
    });
  } catch (error) {
    console.error('Error getting kanban board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавление колонки к доске
router.post('/boards/:boardId/columns', requireAuth, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title, wipLimit } = req.body;
    
    // Проверяем, существует ли доска
    const boardResult = await pool.query(
      'SELECT * FROM kanban_boards WHERE id = $1',
      [boardId]
    );
    
    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Получаем максимальную позицию колонок
    const positionResult = await pool.query(
      'SELECT MAX(position) as max_position FROM kanban_columns WHERE board_id = $1',
      [boardId]
    );
    
    const position = positionResult.rows[0].max_position ? positionResult.rows[0].max_position + 1 : 0;
    
    // Создаем новую колонку
    const result = await pool.query(
      `INSERT INTO kanban_columns (board_id, title, position, wip_limit, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [boardId, title, position, wipLimit]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating column:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получение колонок доски
router.get('/boards/:boardId/columns', requireAuth, async (req, res) => {
  try {
    const { boardId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM kanban_columns WHERE board_id = $1 ORDER BY position',
      [boardId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting columns:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Создание карточки
router.post('/cards', requireAuth, async (req, res) => {
  try {
    const { title, description, columnId, dueDate } = req.body;
    
    // Получаем ID пользователя
    let userResult = await pool.query(
      'SELECT id FROM users WHERE address = $1',
      [req.session.address]
    );
    
    let userId;
    
    if (userResult.rows.length === 0) {
      // Если пользователь не найден, создаем его
      const newUserResult = await pool.query(
        'INSERT INTO users (address, created_at, preferred_language) VALUES ($1, NOW(), $2) RETURNING id',
        [req.session.address, 'ru']
      );
      
      userId = newUserResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }
    
    // Получаем максимальную позицию карточек в колонке
    const positionResult = await pool.query(
      'SELECT MAX(position) as max_position FROM kanban_cards WHERE column_id = $1',
      [columnId]
    );
    
    const position = positionResult.rows[0].max_position ? positionResult.rows[0].max_position + 1 : 0;
    
    // Создаем новую карточку
    const result = await pool.query(
      `INSERT INTO kanban_cards (column_id, title, description, position, due_date, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [columnId, title, description, position, dueDate, userId]
    );
    
    // Получаем информацию о пользователе для отображения
    const cardWithUser = {
      ...result.rows[0],
      assigned_address: null
    };
    
    res.status(201).json(cardWithUser);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавляем остальные маршруты для работы с колонками, карточками и т.д.
// ...

module.exports = router; 