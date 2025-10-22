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

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const { getPool } = require('../db');
const pool = getPool();
const logger = require('../utils/logger');

// Читаем ключ шифрования из файла
async function getEncryptionKey() {
  try {
    const keyPath = '/app/ssl/keys/full_db_encryption.key';
    const key = await fs.readFile(keyPath, 'utf8');
    return key.trim();
  } catch (error) {
    logger.error('Ошибка чтения ключа шифрования:', error);
    throw new Error('Не удалось прочитать ключ шифрования');
  }
}

async function runMigrations() {
  try {
    console.log('Запуск миграций...');

    // Читаем ключ шифрования
    const encryptionKey = await getEncryptionKey();
    console.log('Ключ шифрования загружен');

    // Создаем таблицу для отслеживания миграций, если её нет
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Получаем список выполненных миграций
    const { rows } = await pool.query('SELECT name FROM migrations');
    const executedMigrations = new Set(rows.map((row) => row.name));

    // Читаем файлы миграций
    const migrationsDir = path.join(__dirname, '../db/migrations');
    const files = await fs.readdir(migrationsDir);

    // Сортируем файлы по номеру
    const migrationFiles = files
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0]);
        const numB = parseInt(b.split('_')[0]);
        return numA - numB;
      });

    // Выполняем миграции
    for (const file of migrationFiles) {
      if (!executedMigrations.has(file)) {
        const filePath = path.join(migrationsDir, file);
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Ищем начало UP секции (или начало файла)
        const upMarker = '-- UP Migration';
        const downMarker = '-- DOWN Migration';
        let upSqlStartIndex = fileContent.indexOf(upMarker);
        if (upSqlStartIndex !== -1) {
          // Ищем перевод строки после маркера
          let newlineIndex = fileContent.indexOf('\n', upSqlStartIndex);
          if (newlineIndex === -1) { // Если маркер в последней строке
             newlineIndex = fileContent.length;
          }
          upSqlStartIndex = newlineIndex + 1; // Начинаем со следующей строки
        } else {
          upSqlStartIndex = 0; // Если маркера нет, берем все с начала
        }

        // Ищем конец UP секции (начало DOWN секции)
        let upSqlEndIndex = fileContent.indexOf(downMarker);
        if (upSqlEndIndex === -1) {
          upSqlEndIndex = fileContent.length; // Если маркера DOWN нет, берем все до конца
        }

        // Извлекаем только UP SQL
        const sqlToExecute = fileContent.substring(upSqlStartIndex, upSqlEndIndex).trim();

        if (!sqlToExecute) {
          logger.warn(`Migration file ${file} has no executable UP SQL content. Skipping.`);
          continue; // Пропускаем пустые миграции
        }

        logger.info(`Executing UP migration from ${file}...`);
        await pool.query('BEGIN');
        try {
          // Создаем функцию для получения ключа шифрования
          await pool.query(`
            CREATE OR REPLACE FUNCTION get_encryption_key()
            RETURNS TEXT AS $$
            BEGIN
              RETURN '${encryptionKey}';
            END;
            $$ LANGUAGE plpgsql;
          `);
          
          // Выполняем только извлеченный UP SQL
          await pool.query(sqlToExecute);
          await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await pool.query('COMMIT');
          logger.info(`Migration ${file} executed successfully`);
        } catch (error) {
          await pool.query('ROLLBACK');
          logger.error(`Error executing migration ${file}:`, error); // Логируем ошибку перед пробросом
          throw error;
        }
      }
    }

    // Выполняем SQL-функции
    const functionsDir = path.join(migrationsDir, 'functions');
    if (
      await fs
        .stat(functionsDir)
        .then(() => true)
        .catch(() => false)
    ) {
      const functionFiles = await fs.readdir(functionsDir);

      for (const file of functionFiles) {
        if (file.endsWith('.sql')) {
          const filePath = path.join(functionsDir, file);
          const sql = await fs.readFile(filePath, 'utf-8');

          try {
            await pool.query(sql);
            logger.info(`Function ${file} executed successfully`);
          } catch (error) {
            logger.error(`Error executing function ${file}:`, error);
            throw error;
          }
        }
      }
    }

    console.log('Все миграции успешно применены');
  } catch (error) {
    console.error('Ошибка при выполнении миграций:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
