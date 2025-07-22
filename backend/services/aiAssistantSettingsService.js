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

const db = require('../db');
const TABLE = 'ai_assistant_settings';

async function getSettings() {
  const { rows } = await db.getQuery()(`SELECT * FROM ${TABLE} ORDER BY id LIMIT 1`);
  const settings = rows[0] || null;
  if (!settings) return null;

  // Получаем связанные данные из telegram_settings и email_settings
  let telegramBot = null;
  let supportEmail = null;
  if (settings.telegram_settings_id) {
    const tg = await db.getQuery()('SELECT * FROM telegram_settings WHERE id = $1', [settings.telegram_settings_id]);
    telegramBot = tg.rows[0] || null;
  }
  if (settings.email_settings_id) {
    const em = await db.getQuery()('SELECT * FROM email_settings WHERE id = $1', [settings.email_settings_id]);
    supportEmail = em.rows[0] || null;
  }
  return {
    ...settings,
    telegramBot,
    supportEmail,
    embedding_model: settings.embedding_model
  };
}

async function upsertSettings({ system_prompt, selected_rag_tables, languages, model, embedding_model, rules, updated_by, telegram_settings_id, email_settings_id, system_message }) {
  const { rows } = await db.getQuery()(
    `INSERT INTO ${TABLE} (id, system_prompt, selected_rag_tables, languages, model, embedding_model, rules, updated_at, updated_by, telegram_settings_id, email_settings_id, system_message)
     VALUES (1, $1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       system_prompt = EXCLUDED.system_prompt,
       selected_rag_tables = EXCLUDED.selected_rag_tables,
       languages = EXCLUDED.languages,
       model = EXCLUDED.model,
       embedding_model = EXCLUDED.embedding_model,
       rules = EXCLUDED.rules,
       updated_at = NOW(),
       updated_by = EXCLUDED.updated_by,
       telegram_settings_id = EXCLUDED.telegram_settings_id,
       email_settings_id = EXCLUDED.email_settings_id,
       system_message = EXCLUDED.system_message
     RETURNING *`,
    [system_prompt, selected_rag_tables, languages, model, embedding_model, rules, updated_by, telegram_settings_id, email_settings_id, system_message]
  );
  return rows[0];
}

module.exports = { getSettings, upsertSettings }; 