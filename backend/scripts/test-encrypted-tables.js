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

const encryptedDb = require('../services/encryptedDatabaseService');
const db = require('../db');

async function testEncryptedTables() {
  console.log('🔐 Тестирование зашифрованных таблиц...\n');

  try {
    // Тестируем таблицу is_rag_source
    console.log('1. Тестирование таблицы is_rag_source:');
    const ragSources = await encryptedDb.getData('is_rag_source', {});
    console.log('   ✅ Данные получены:', ragSources);
    
    // Тестируем через прямой SQL запрос
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    const directResult = await db.getQuery()(
      'SELECT id, decrypt_text(name_encrypted, $1) as name FROM is_rag_source ORDER BY id',
      [encryptionKey]
    );
    console.log('   ✅ Прямой SQL запрос:', directResult.rows);

    // Тестируем другие важные таблицы
    console.log('\n2. Тестирование других зашифрованных таблиц:');
    
    // user_tables
    const userTables = await encryptedDb.getData('user_tables', {}, 5);
    console.log('   ✅ user_tables (первые 5):', userTables.length, 'записей');
    
    // user_columns
    const userColumns = await encryptedDb.getData('user_columns', {}, 5);
    console.log('   ✅ user_columns (первые 5):', userColumns.length, 'записей');
    
    // messages
    const messages = await encryptedDb.getData('messages', {}, 3);
    console.log('   ✅ messages (первые 3):', messages.length, 'записей');
    
    // conversations
    const conversations = await encryptedDb.getData('conversations', {}, 3);
    console.log('   ✅ conversations (первые 3):', conversations.length, 'записей');

    console.log('\n✅ Все тесты прошли успешно!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
if (require.main === module) {
  testEncryptedTables().then(() => {
    console.log('\n🏁 Тест завершен');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { testEncryptedTables }; 