const { Pool } = require('pg');
require('dotenv').config();

// Выводим настройки подключения (без пароля)
console.log('Настройки подключения к базе данных:');
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'));
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);

// Первичное подключение по дефолтным значениям
let pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dapp_db',
  user: process.env.DB_USER || 'dapp_user',
  password: process.env.DB_PASSWORD,
  ssl: false,
});

// Проверяем подключение к базе данных
pool.query('SELECT NOW()')
  .then(res => {
    console.log('Успешное подключение к базе данных:', res.rows[0]);
  })
  .catch(err => {
    console.error('Ошибка подключения к базе данных:', err);
  });

console.log('Пул создан:', pool.options || pool);

function getPool() {
  return pool;
}

function getQuery() {
  return pool.query.bind(pool);
}

let poolChangeCallback = null;

function setPoolChangeCallback(cb) {
  poolChangeCallback = cb;
}

// Функция для пересоздания пула из db_settings
async function reinitPoolFromDbSettings() {
  try {
    const res = await pool.query('SELECT * FROM db_settings ORDER BY id LIMIT 1');
    if (!res.rows.length) throw new Error('DB settings not found');
    const settings = res.rows[0];
    // Закрываем старый пул
    await pool.end();
    // Создаём новый пул
    pool = new Pool({
      host: settings.db_host,
      port: parseInt(settings.db_port),
      database: settings.db_name,
      user: settings.db_user,
      password: settings.db_password,
      ssl: false,
    });
    // Пересоздаём session middleware
    if (poolChangeCallback) {
      poolChangeCallback();
    }
    console.log('Пул пересоздан с новыми параметрами:', settings);
  } catch (err) {
    console.error('Ошибка пересоздания пула:', err);
    throw err;
  }
}

// При старте приложения — сразу пробуем инициализировать из db_settings
if (process.env.NODE_ENV !== 'migration') {
  reinitPoolFromDbSettings();
}

const query = (text, params) => pool.query(text, params);

// Функция для сохранения гостевого сообщения в базе данных
async function saveGuestMessageToDatabase(message, language, guestId) {
  try {
    await query(
      `
      INSERT INTO guest_messages (guest_id, content, language, created_at)
      VALUES ($1, $2, $3, NOW())
    `,
      [guestId, message, language]
    );
    console.log('Гостевое сообщение успешно сохранено:', message);
  } catch (error) {
    console.error('Ошибка при сохранении гостевого сообщения:', error);
    throw error; // Пробрасываем ошибку дальше
  }
}

// Экспортируем функции для работы с базой данных
module.exports = { getQuery, pool, getPool, setPoolChangeCallback };
