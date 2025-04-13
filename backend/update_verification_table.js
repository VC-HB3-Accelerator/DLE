// Скрипт для обновления таблицы verification_codes
const { Pool } = require('pg');
require('dotenv').config();

// Создаем подключение к базе данных
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'dapp_business',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

async function updateVerificationTable() {
  try {
    console.log('Начинаем обновление таблицы verification_codes...');
    
    // Проверяем, существует ли таблица
    const checkTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'verification_codes'
      );
    `);
    
    const tableExists = checkTableResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Таблица verification_codes не существует. Пропускаем обновление.');
      return;
    }
    
    // Проверяем, разрешает ли уже колонка null значения
    const checkColumnResult = await pool.query(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'verification_codes' 
      AND column_name = 'user_id';
    `);
    
    if (checkColumnResult.rows.length > 0 && checkColumnResult.rows[0].is_nullable === 'YES') {
      console.log('Колонка user_id уже разрешает NULL значения. Пропускаем обновление.');
      return;
    }
    
    // Начинаем транзакцию
    await pool.query('BEGIN');
    
    // Изменяем ограничение для поля user_id
    await pool.query(`
      ALTER TABLE verification_codes 
      ALTER COLUMN user_id DROP NOT NULL;
    `);
    
    // Добавляем комментарий к колонке
    await pool.query(`
      COMMENT ON COLUMN verification_codes.user_id IS 'ID пользователя (может быть NULL для временных кодов)';
    `);
    
    // Фиксируем транзакцию
    await pool.query('COMMIT');
    
    console.log('Таблица verification_codes успешно обновлена!');
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await pool.query('ROLLBACK');
    console.error('Ошибка при обновлении таблицы verification_codes:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Выполняем обновление
updateVerificationTable(); 