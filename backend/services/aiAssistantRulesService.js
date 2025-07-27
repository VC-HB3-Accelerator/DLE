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
const TABLE = 'ai_assistant_rules';

async function getAllRules() {
  const rules = await encryptedDb.getData(TABLE, {}, null, 'id');
  return rules;
}

async function getRuleById(id) {
  const rules = await encryptedDb.getData(TABLE, { id: id }, 1);
  return rules[0] || null;
}

async function createRule({ name, description, rules }) {
  const rule = await encryptedDb.saveData(TABLE, {
    name: name,
    description: description,
    rules: rules,
    created_at: new Date(),
    updated_at: new Date()
  });
  return rule;
}

async function updateRule(id, { name, description, rules }) {
  const rule = await encryptedDb.saveData(TABLE, {
    name: name,
    description: description,
    rules: rules,
    updated_at: new Date()
  }, {
    id: id
  });
  return rule;
}

async function deleteRule(id) {
  await encryptedDb.deleteData(TABLE, { id: id });
}

module.exports = { getAllRules, getRuleById, createRule, updateRule, deleteRule }; 