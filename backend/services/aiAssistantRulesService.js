/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');
const TABLE = 'ai_assistant_rules';

function normalizeTagIds(raw) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .map((id) => parseInt(id, 10))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function normalizeRulesPayload(rules, tagIds) {
  const payload = (rules && typeof rules === 'object' && !Array.isArray(rules))
    ? { ...rules }
    : {};
  const ids = normalizeTagIds(
    tagIds !== undefined ? tagIds : payload.tag_ids
  );
  payload.tag_ids = ids;
  return payload;
}

function enrichRuleRow(rule) {
  if (!rule) return null;
  const tagIds = normalizeTagIds(rule.rules?.tag_ids);
  return {
    ...rule,
    name: rule.name || `Правило ${rule.id}`,
    displayName: rule.name || `Правило ${rule.id}`,
    tag_ids: tagIds,
    rules: normalizeRulesPayload(rule.rules, tagIds)
  };
}

async function getAllRules() {
  try {
    logger.info('[aiAssistantRulesService] getAllRules called');
    const rules = await encryptedDb.getData(TABLE, {}, null, 'id');
    const processedRules = (rules || []).map(enrichRuleRow);
    logger.info(
      `[aiAssistantRulesService] Found ${processedRules.length} rules:`,
      processedRules.map((r) => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        tag_ids: r.tag_ids
      }))
    );
    return processedRules;
  } catch (error) {
    logger.error('[aiAssistantRulesService] Error in getAllRules:', error);
    throw error;
  }
}

async function getRuleById(id) {
  try {
    logger.info(`[aiAssistantRulesService] getRuleById called for ID: ${id}`);
    const rules = await encryptedDb.getData(TABLE, { id }, 1);
    const rule = enrichRuleRow(rules[0] || null);
    if (rule) {
      logger.info('[aiAssistantRulesService] Found rule:', {
        id: rule.id,
        name: rule.name,
        displayName: rule.displayName,
        tag_ids: rule.tag_ids
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

/**
 * Наборы правил, привязанные к тегам пользователя (пересечение tag_ids).
 * @param {number[]} tagIds
 */
async function getRulesForTagIds(tagIds) {
  const userTagIds = normalizeTagIds(tagIds);
  if (!userTagIds.length) return [];

  const all = await getAllRules();
  const matched = all.filter((rule) => {
    const ruleTagIds = normalizeTagIds(rule.tag_ids || rule.rules?.tag_ids);
    return ruleTagIds.some((id) => userTagIds.includes(id));
  });

  logger.info(
    `[aiAssistantRulesService] Правила по тегам [${userTagIds.join(',')}]: ${matched.length} шт.`
  );
  return matched;
}

/**
 * Собирает объект правил для generateLLMResponse:
 * byTags — по тегам пользователя, global — выбранный в настройках набор.
 */
async function resolveRulesForUser({ rulesId = null, tagIds = [] } = {}) {
  const byTags = await getRulesForTagIds(tagIds);
  let global = null;
  if (rulesId) {
    global = await getRuleById(rulesId);
    // Не дублировать, если тот же набор уже попал по тегу
    if (global && byTags.some((r) => r.id === global.id)) {
      global = null;
    }
  }

  return {
    byTags: byTags.map((r) => ({
      id: r.id,
      name: r.displayName || r.name,
      system_prompt: r.rules?.system_prompt || '',
      allowed_topics: r.rules?.rules?.allowed_topics || [],
      forbidden_words: r.rules?.rules?.forbidden_words || [],
      tag_ids: r.tag_ids || []
    })),
    global: global
      ? {
          id: global.id,
          name: global.displayName || global.name,
          system_prompt: global.rules?.system_prompt || '',
          allowed_topics: global.rules?.rules?.allowed_topics || [],
          forbidden_words: global.rules?.rules?.forbidden_words || [],
          tag_ids: global.tag_ids || []
        }
      : null
  };
}

/**
 * Текст блока правил для system prompt.
 * @param {{ byTags?: Array, global?: object|null, system_prompt?: string }} rules
 */
function formatRulesForSystemPrompt(rules) {
  if (!rules) return '';

  const blocks = [];

  const appendEntry = (title, entry) => {
    if (!entry) return;
    const lines = [];
    if (entry.system_prompt && String(entry.system_prompt).trim()) {
      lines.push(String(entry.system_prompt).trim());
    }
    if (Array.isArray(entry.allowed_topics) && entry.allowed_topics.length) {
      lines.push(`Разрешённые темы: ${entry.allowed_topics.join(', ')}`);
    }
    if (Array.isArray(entry.forbidden_words) && entry.forbidden_words.length) {
      lines.push(`Запрещённые слова/темы: ${entry.forbidden_words.join(', ')}`);
    }
    if (!lines.length) return;
    const name = entry.name ? ` «${entry.name}»` : '';
    blocks.push(`${title}${name}:\n${lines.join('\n')}`);
  };

  if (Array.isArray(rules.byTags) && rules.byTags.length) {
    for (const entry of rules.byTags) {
      appendEntry('Правила по тегам пользователя', entry);
    }
  }

  if (rules.global) {
    appendEntry('Базовый набор правил', rules.global);
  }

  // Legacy: передали плоский объект rules из одного набора
  if (!rules.byTags && !rules.global && (rules.system_prompt || rules.rules)) {
    appendEntry('Правила ассистента', {
      name: rules.name,
      system_prompt: rules.system_prompt,
      allowed_topics: rules.rules?.allowed_topics || rules.allowed_topics,
      forbidden_words: rules.rules?.forbidden_words || rules.forbidden_words
    });
  }

  if (!blocks.length) return '';

  return (
    'Ниже — обязательные правила. Правила по тегам важнее общего system prompt и шаблонных формулировок.\n\n'
    + blocks.join('\n\n')
  );
}

async function createRule({ name, description, rules, tag_ids }) {
  const payload = normalizeRulesPayload(rules, tag_ids);
  const rule = await encryptedDb.saveData(TABLE, {
    name,
    description,
    rules: payload,
    created_at: new Date(),
    updated_at: new Date()
  });
  return enrichRuleRow(rule);
}

async function updateRule(id, { name, description, rules, tag_ids }) {
  const payload = normalizeRulesPayload(rules, tag_ids);
  const rule = await encryptedDb.saveData(TABLE, {
    name,
    description,
    rules: payload,
    updated_at: new Date()
  }, {
    id
  });
  return enrichRuleRow(rule);
}

async function deleteRule(id) {
  await encryptedDb.deleteData(TABLE, { id });
}

module.exports = {
  getAllRules,
  getRuleById,
  getRulesForTagIds,
  resolveRulesForUser,
  formatRulesForSystemPrompt,
  normalizeTagIds,
  createRule,
  updateRule,
  deleteRule
};
