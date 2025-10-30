/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const db = require('../db');

async function fixRagColumns() {
  console.log('🔧 Исправление purpose у колонок в RAG таблице...\n');

  try {
    // Получаем ключ шифрования
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

    // Получаем колонки таблицы RAG (ID 28)
    const columns = await db.getQuery()(
      'SELECT id, decrypt_text(name_encrypted, $1) as name FROM user_columns WHERE table_id = 28 ORDER BY id',
      [encryptionKey]
    );

    console.log('Найденные колонки в таблице RAG:');
    columns.rows.forEach(col => {
      console.log(`  ID: ${col.id}, Name: ${col.name}`);
    });

    // Маппинг названий колонок на purpose
    const purposeMapping = {
      'Вопрос': 'question',
      'Ответ': 'answer', 
      'Контекст теги': 'context',
      'Продукт теги': 'product',
      'Клиент теги': 'userTags'
    };

    // Обновляем каждую колонку
    for (const col of columns.rows) {
      const purpose = purposeMapping[col.name];
      if (purpose) {
        console.log(`\nОбновляем колонку "${col.name}" (ID: ${col.id}) -> purpose: ${purpose}`);
        
        // Получаем текущие options
        const currentOptions = await db.getQuery()(
          'SELECT options FROM user_columns WHERE id = $1',
          [col.id]
        );
        
        let options = currentOptions.rows[0]?.options || {};
        options.purpose = purpose;
        
        // Обновляем колонку
        await db.getQuery()(
          'UPDATE user_columns SET options = $1 WHERE id = $2',
          [JSON.stringify(options), col.id]
        );
        
        console.log(`  ✅ Обновлено`);
      } else {
        console.log(`\n⚠️  Колонка "${col.name}" (ID: ${col.id}) - purpose не определен`);
      }
    }

    console.log('\n✅ Исправление завершено!');
    
    // Проверяем результат
    console.log('\nПроверка результата:');
    const updatedColumns = await db.getQuery()(
      'SELECT id, decrypt_text(name_encrypted, $1) as name, options FROM user_columns WHERE table_id = 28 ORDER BY id',
      [encryptionKey]
    );
    
    updatedColumns.rows.forEach(col => {
      const options = col.options || {};
      console.log(`  ID: ${col.id}, Name: ${col.name}, Purpose: ${options.purpose || 'undefined'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Запуск скрипта
if (require.main === module) {
  fixRagColumns().then(() => {
    console.log('\n🏁 Скрипт завершен');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { fixRagColumns }; 