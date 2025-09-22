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

const { Pool } = require('pg');
require('dotenv').config();
const axios = require('axios');

// Убираем избыточное логирование настроек подключения
// console.log('Настройки подключения к базе данных:');
// console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@'));
// console.log('DB_HOST:', process.env.DB_HOST);
// console.log('DB_PORT:', process.env.DB_PORT);
// console.log('DB_NAME:', process.env.DB_NAME);
// console.log('DB_USER:', process.env.DB_USER);

// Первичное подключение по дефолтным значениям
let pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'dapp_db',
  user: process.env.DB_USER || 'dapp_user',
  password: process.env.DB_PASSWORD,
  ssl: false,
  // Настройки для предотвращения утечек памяти
  max: 10, // Максимальное количество клиентов в пуле
  min: 0, // Минимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // Время жизни неактивного клиента (30 сек)
  connectionTimeoutMillis: 30000, // Таймаут подключения (30 сек)
  maxUses: 7500, // Максимальное количество использований клиента
  allowExitOnIdle: true, // Разрешить выход при отсутствии активных клиентов
});

// Увеличиваем лимит обработчиков событий для предотвращения предупреждений
pool.setMaxListeners(20);

// Добавляем обработчики для правильного закрытия пула
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Обработчик для очистки при завершении процесса
process.on('SIGINT', async () => {
  // console.log('Closing database pool...'); // Убрано избыточное логирование
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  // console.log('Closing database pool...'); // Убрано избыточное логирование
  await pool.end();
  process.exit(0);
});

// console.log('Пул создан:', pool.options || pool); // Убрано избыточное логирование

// Проверяем подключение к базе данных
pool.query('SELECT NOW()')
  .then(res => {
    // console.log('Успешное подключение к базе данных:', res.rows[0]); // Убрано избыточное логирование
  })
  .catch(err => {
    console.error('Ошибка подключения к базе данных:', err);
  });

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
    // Используем прямое подключение для получения настроек
    const res = await pool.query('SELECT * FROM db_settings ORDER BY id LIMIT 1');
    if (!res.rows.length) throw new Error('DB settings not found');
    const dbSettings = res.rows[0];
    
    // Закрываем старый пул правильно
    console.log('Закрываем старый пул подключений...');
    await pool.end();
    
    // Создаём новый пул с расшифрованными настройками и теми же параметрами для предотвращения утечек
    pool = new Pool({
      host: dbSettings.db_host_encrypted ? await decryptValue(dbSettings.db_host_encrypted) : process.env.DB_HOST || 'postgres',
      port: parseInt(dbSettings.db_port || process.env.DB_PORT || '5432'),
      database: dbSettings.db_name_encrypted ? await decryptValue(dbSettings.db_name_encrypted) : process.env.DB_NAME || 'dapp_db',
      user: dbSettings.db_user_encrypted ? await decryptValue(dbSettings.db_user_encrypted) : process.env.DB_USER || 'dapp_user',
      password: dbSettings.db_password_encrypted ? await decryptValue(dbSettings.db_password_encrypted) : process.env.DB_PASSWORD,
      ssl: false,
      // Те же настройки для предотвращения утечек
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      maxUses: 7500,
      allowExitOnIdle: true,
    });
    
    // Устанавливаем лимит обработчиков для нового пула
    pool.setMaxListeners(20);
    
    // Добавляем обработчики ошибок для нового пула
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
    
    // Пересоздаём session middleware
    if (poolChangeCallback) {
      poolChangeCallback();
    }
    console.log('Пул пересоздан с новыми параметрами из зашифрованных настроек');
  } catch (err) {
    console.error('Ошибка пересоздания пула:', err);
    // Используем дефолтные настройки при ошибке
    console.log('Используем дефолтные настройки подключения');
  }
}

// Функция для расшифровки значений
async function decryptValue(encryptedValue) {
  try {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (!fs.existsSync(keyPath)) {
      console.warn('Ключ шифрования не найден, используем дефолтные значения');
      return null;
    }
    
    const key = fs.readFileSync(keyPath, 'utf8').trim();
    const algorithm = 'aes-256-cbc';
    
    // Декодируем base64
    const encryptedBuffer = Buffer.from(encryptedValue, 'base64');
    
    // Извлекаем IV (первые 16 байт)
    const iv = encryptedBuffer.slice(0, 16);
    const encryptedData = encryptedBuffer.slice(16);
    
    // Расшифровываем
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAutoPadding(false);
    
    let decrypted = decipher.update(encryptedData, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    // Убираем padding
    const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
    decrypted = decrypted.slice(0, decrypted.length - paddingLength);
    
    return decrypted;
  } catch (error) {
    console.error('Ошибка расшифровки:', error);
    return null;
  }
}

// При старте приложения — убираем автоматический вызов reinitPoolFromDbSettings
// if (process.env.NODE_ENV !== 'migration') {
//   reinitPoolFromDbSettings();
// }

// Экспортируем функцию для явной инициализации пула
async function initDbPool() {
  // Отключаем автоматическое пересоздание пула из настроек БД
  // await reinitPoolFromDbSettings();
  console.log('Используем дефолтные настройки подключения к БД');
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
    // console.log('Гостевое сообщение успешно сохранено:', message); // Убрано избыточное логирование
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
      // console.log(`[seedAIAssistantSettings] Ожидание загрузки модели ${modelName}...`); // Убрано избыточное логирование
    } catch (e) {
      // console.log('[seedAIAssistantSettings] Ollama недоступна, ожидание...'); // Убрано избыточное логирование
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

async function seedAIAssistantSettings() {
  const modelName = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  await waitForOllamaModel(modelName);
  const res = await pool.query('SELECT COUNT(*) FROM ai_assistant_settings');
  if (parseInt(res.rows[0].count, 10) === 0) {
    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, 'ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    await pool.query(`
      INSERT INTO ai_assistant_settings (system_prompt_encrypted, selected_rag_tables, languages, model_encrypted, rules_id, updated_by)
      VALUES (encrypt_text($1, $6), $2, $3, encrypt_text($4, $6), $5, $7)
    `, [
      'Ты — ИИ-ассистент для бизнеса. Отвечай кратко и по делу.',
      [],
      ['ru'],
      modelName,
      1,
      encryptionKey,
      1
    ]);
    // console.log('[seedAIAssistantSettings] ai_assistant_settings: инициализировано дефолтными значениями'); // Убрано избыточное логирование
  } else {
    // console.log('[seedAIAssistantSettings] ai_assistant_settings: уже инициализировано, пропускаю'); // Убрано избыточное логирование
  }
}

// Экспортируем функции для работы с базой данных
module.exports = { query, getQuery, pool, getPool, setPoolChangeCallback, initDbPool, seedAIAssistantSettings };
