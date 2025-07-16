const { Pool } = require('pg');
require('dotenv').config();
const axios = require('axios');

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

function query(text, params) {
  return pool.query(text, params);
}

function getQuery() {
  return (...args) => pool.query(...args);
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

// При старте приложения — убираем автоматический вызов reinitPoolFromDbSettings
// if (process.env.NODE_ENV !== 'migration') {
//   reinitPoolFromDbSettings();
// }

// Экспортируем функцию для явной инициализации пула
async function initDbPool() {
  if (process.env.NODE_ENV !== 'migration') {
    await reinitPoolFromDbSettings();
  }
}

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

async function waitForOllamaModel(modelName) {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
  while (true) {
    try {
      const res = await axios.get(`${ollamaUrl}/api/tags`);
      const models = res.data.models.map(m => m.name);
      if (models.includes(modelName)) {
        return true;
      }
      console.log(`[seedAIAssistantSettings] Ожидание загрузки модели ${modelName}...`);
    } catch (e) {
      console.log('[seedAIAssistantSettings] Ollama недоступна, ожидание...');
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function seedAIAssistantSettings() {
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  await waitForOllamaModel(modelName);
  const res = await pool.query('SELECT COUNT(*) FROM ai_assistant_settings');
  if (parseInt(res.rows[0].count, 10) === 0) {
    await pool.query(`
      INSERT INTO ai_assistant_settings (system_prompt, selected_rag_tables, languages, model, rules, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'Ты — ИИ-ассистент для бизнеса. Отвечай кратко и по делу.',
      [],
      ['ru'],
      modelName,
      JSON.stringify({}),
      1
    ]);
    console.log('[seedAIAssistantSettings] ai_assistant_settings: инициализировано дефолтными значениями');
  } else {
    console.log('[seedAIAssistantSettings] ai_assistant_settings: уже инициализировано, пропускаю');
  }
}

// Экспортируем функции для работы с базой данных
module.exports = { query, getQuery, pool, getPool, setPoolChangeCallback, initDbPool, seedAIAssistantSettings };
