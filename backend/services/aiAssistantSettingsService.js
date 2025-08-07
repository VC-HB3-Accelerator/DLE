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

const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const TABLE = 'ai_assistant_settings';

async function getSettings() {
  const settings = await encryptedDb.getData(TABLE, {}, 1, 'id');
  const setting = settings[0] || null;
  if (!setting) return null;

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
    // console.error('Error reading encryption key:', keyError);
  }
  
  // Получаем связанные данные из telegram_settings и email_settings
  let telegramBot = null;
  let supportEmail = null;
  if (setting.telegram_settings_id) {
    const tg = await db.getQuery()(
      'SELECT id, created_at, updated_at, decrypt_text(bot_token_encrypted, $2) as bot_token, decrypt_text(bot_username_encrypted, $2) as bot_username FROM telegram_settings WHERE id = $1',
      [setting.telegram_settings_id, encryptionKey]
    );
    telegramBot = tg.rows[0] || null;
  }
  if (setting.email_settings_id) {
    const em = await db.getQuery()(
      'SELECT id, smtp_port, imap_port, created_at, updated_at, decrypt_text(smtp_host_encrypted, $2) as smtp_host, decrypt_text(smtp_user_encrypted, $2) as smtp_user, decrypt_text(smtp_password_encrypted, $2) as smtp_password, decrypt_text(imap_host_encrypted, $2) as imap_host, decrypt_text(from_email_encrypted, $2) as from_email FROM email_settings WHERE id = $1',
      [setting.email_settings_id, encryptionKey]
    );
    supportEmail = em.rows[0] || null;
  }

  return {
    ...setting,
    telegramBot,
    supportEmail,
    embedding_model: setting.embedding_model
  };
}

async function upsertSettings({ system_prompt, selected_rag_tables, model, embedding_model, rules, updated_by, telegram_settings_id, email_settings_id, system_message }) {
  const data = {
    id: 1,
    system_prompt,
    selected_rag_tables,
    languages: ['ru'], // Устанавливаем русский язык по умолчанию
    model,
    embedding_model,
    rules,
    updated_at: new Date(),
    updated_by,
    telegram_settings_id,
    email_settings_id,
    system_message
  };

  // Проверяем, существует ли запись
  const existing = await encryptedDb.getData(TABLE, { id: 1 }, 1);
  
  if (existing.length > 0) {
    // Обновляем существующую запись
    return await encryptedDb.saveData(TABLE, data, { id: 1 });
  } else {
    // Создаем новую запись
    return await encryptedDb.saveData(TABLE, data);
  }
}

module.exports = { getSettings, upsertSettings }; 