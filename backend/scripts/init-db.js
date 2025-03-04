const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  try {
    console.log('Инициализация базы данных...');

    // Добавляем тестового пользователя
    await pool.query(`
      INSERT INTO users (address, is_admin)
      VALUES ('0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b', TRUE)
      ON CONFLICT (address) DO NOTHING
    `);

    // Добавляем тестовую доску
    await pool.query(`
      INSERT INTO kanban_boards (title, description, owner_id, is_public)
      VALUES (
        'Тестовая доска', 
        'Описание тестовой доски', 
        (SELECT id FROM users WHERE address = '0xf45aa4917b3775ba37f48aeb3dc1a943561e9e0b'), 
        TRUE
      )
      ON CONFLICT DO NOTHING
    `);

    // Получаем ID доски
    const boardResult = await pool.query(`
      SELECT id FROM kanban_boards WHERE title = 'Тестовая доска' LIMIT 1
    `);

    if (boardResult.rows.length > 0) {
      const boardId = boardResult.rows[0].id;

      // Добавляем тестовые колонки
      await pool.query(
        `
        INSERT INTO kanban_columns (board_id, title, position)
        VALUES 
          ($1, 'Backlog', 0),
          ($1, 'In Progress', 1),
          ($1, 'Review', 2),
          ($1, 'Done', 3)
        ON CONFLICT DO NOTHING
      `,
        [boardId]
      );
    }

    console.log('База данных инициализирована успешно');
  } catch (error) {
    console.error('Ошибка при инициализации базы данных:', error);
  } finally {
    await pool.end();
  }
}

initDb();
