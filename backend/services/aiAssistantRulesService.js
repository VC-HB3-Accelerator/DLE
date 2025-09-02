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
const logger = require('../utils/logger');
const TABLE = 'ai_assistant_rules';

async function getAllRules() {
  try {
    logger.info('[aiAssistantRulesService] getAllRules called');
    const rules = await encryptedDb.getData(TABLE, {}, null, 'id');
    
    // Добавляем fallback названия для правил с null именами
    const processedRules = rules.map(rule => ({
      ...rule,
      name: rule.name || `Правило ${rule.id}`,
      displayName: rule.name || `Правило ${rule.id}`
    }));
    
    logger.info(`[aiAssistantRulesService] Found ${processedRules.length} rules:`, 
      processedRules.map(r => ({ id: r.id, name: r.name, displayName: r.displayName })));
    
    return processedRules;
  } catch (error) {
    logger.error('[aiAssistantRulesService] Error in getAllRules:', error);
    throw error;
  }
}

async function getRuleById(id) {
  try {
    logger.info(`[aiAssistantRulesService] getRuleById called for ID: ${id}`);
    const rules = await encryptedDb.getData(TABLE, { id: id }, 1);
    const rule = rules[0] || null;
    
    if (rule) {
      // Добавляем fallback название
      rule.displayName = rule.name || `Правило ${rule.id}`;
      logger.info(`[aiAssistantRulesService] Found rule:`, { 
        id: rule.id, 
        name: rule.name, 
        displayName: rule.displayName 
      });
    } else {
      logger.warn(`[aiAssistantRulesService] Rule with ID ${id} not found`);
    }
    
    return rule;
  } catch (error) {
    logger.error(`[aiAssistantRulesService] Error in getRuleById for ID ${id}:`, error);
    throw error;
  }
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