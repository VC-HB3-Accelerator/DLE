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
const {
  isAudienceSlug,
  isModeSlug,
  canonicalAudience,
  canonicalMode,
  normalizeSlug
} = require('./assistantTurnContext');
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

function parseRulesObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      return {};
    } catch (_) {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

function enrichRuleRow(rule) {
  if (!rule) return null;
  const parsed = parseRulesObject(rule.rules);
  const tagIds = normalizeTagIds(parsed.tag_ids);
  return {
    ...rule,
    name: rule.name || `Правило ${rule.id}`,
    displayName: rule.name || `Правило ${rule.id}`,
    tag_ids: tagIds,
    rules: normalizeRulesPayload(parsed, tagIds)
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

function slugOfTag(tagId, slugById) {
  if (!slugById) return '';
  if (slugById instanceof Map) return normalizeSlug(slugById.get(tagId));
  return normalizeSlug(slugById[tagId]);
}

function classifyRuleTags(rule, slugById) {
  const ids = normalizeTagIds(rule.tag_ids || rule.rules?.tag_ids);
  const slugs = ids.map((id) => slugOfTag(id, slugById) || (rule.slugByTagId && rule.slugByTagId[id]) || '')
    .map(normalizeSlug)
    .filter(Boolean);
  if (!ids.length && !slugs.length) return { kind: 'base', ids, slugs };
  const modes = slugs.filter((s) => isModeSlug(s)).map(canonicalMode);
  const auds = slugs.filter((s) => isAudienceSlug(s)).map(canonicalAudience);
  if (modes.length && auds.length) return { kind: 'combo', ids, slugs };
  if (modes.length && !auds.length) return { kind: 'mode', ids, slugs: modes };
  if (auds.length && !modes.length) return { kind: 'audience', ids, slugs: auds };
  return { kind: 'combo', ids, slugs };
}

function toPromptEntry(rule) {
  if (!rule) return null;
  return {
    id: rule.id,
    name: rule.displayName || rule.name,
    system_prompt: rule.rules?.system_prompt || rule.system_prompt || '',
    allowed_topics: rule.rules?.rules?.allowed_topics || rule.allowed_topics || [],
    forbidden_words: rule.rules?.rules?.forbidden_words || rule.forbidden_words || [],
    tag_ids: rule.tag_ids || [],
    generateIfNoRag: Boolean(rule.rules?.rules?.generateIfNoRag)
  };
}

function resolveGenerateIfNoRag(rulesObj, { isGuest = false } = {}) {
  if (isGuest) return false;
  const entries = [
    ...(Array.isArray(rulesObj?.byTags) ? rulesObj.byTags : []),
    rulesObj?.global
  ].filter(Boolean);
  return entries.some((e) => e.generateIfNoRag === true);
}

function deepMergeRules(base, patch) {
  const a = parseRulesObject(base);
  const b = parseRulesObject(patch);
  const nested = {
    ...(a.rules && typeof a.rules === 'object' ? a.rules : {}),
    ...(b.rules && typeof b.rules === 'object' ? b.rules : {})
  };
  const out = { ...a, ...b };
  if (Object.keys(nested).length) out.rules = nested;
  return out;
}

/**
 * Матч слоя B: combo = AND всех slug; mode/audience — одно правило оси.
 * Гость / user без ЦА: matchTaggedRules=false → byTags пусто.
 */
function selectMatchedRules(allRules, {
  includeBase = true,
  matchTaggedRules = false,
  audienceSlugs = [],
  modeSlugs = [],
  slugById = new Map()
} = {}) {
  const audSet = new Set((audienceSlugs || []).map(canonicalAudience));
  const modeSet = new Set((modeSlugs || []).map(canonicalMode));
  const allUser = new Set([...audSet, ...modeSet]);

  const classified = (allRules || []).map((rule) => ({
    rule,
    ...classifyRuleTags(rule, slugById)
  }));

  const byTags = [];
  if (matchTaggedRules) {
    const modeHits = classified.filter((c) => c.kind === 'mode' && c.slugs.some((s) => modeSet.has(s)));
    const audHits = classified.filter((c) => c.kind === 'audience' && c.slugs.some((s) => audSet.has(s)));
    const comboHits = classified.filter((c) => {
      if (c.kind !== 'combo' || !c.slugs.length) return false;
      return c.slugs.every((s) => {
        const aud = canonicalAudience(s);
        const mode = canonicalMode(s);
        return allUser.has(s) || allUser.has(aud) || allUser.has(mode);
      });
    });

    const pickOne = (hits, preferSlugs) => {
      if (!hits.length) return null;
      for (const slug of preferSlugs || []) {
        const hit = hits.find((c) => c.slugs.includes(slug));
        if (hit) return hit;
      }
      return hits[0];
    };

    const modeRule = pickOne(modeHits, [...modeSet]);
    const audRule = pickOne(audHits, ['investor-a', 'partner', 'public-client']);
    if (modeRule) byTags.push(toPromptEntry(modeRule.rule));
    if (audRule && (!modeRule || audRule.rule.id !== modeRule.rule.id)) {
      byTags.push(toPromptEntry(audRule.rule));
    }
    for (const combo of comboHits) {
      if (byTags.some((r) => r.id === combo.rule.id)) continue;
      byTags.push(toPromptEntry(combo.rule));
    }
  }

  return {
    byTags,
    includeBase
  };
}

/**
 * Наборы правил, привязанные к тегам (AND для combo).
 * @param {number[]} tagIds
 */
async function getRulesForTagIds(tagIds, options = {}) {
  const userTagIds = normalizeTagIds(tagIds);
  if (!userTagIds.length) return [];

  const all = await getAllRules();
  const slugById = await loadSlugById(all, userTagIds);
  const userSlugs = userTagIds.map((id) => slugById.get(id)).filter(Boolean);
  const { splitTagNames, pickAudienceSlug, pickModeSlug } = require('./assistantTurnContext');
  const axes = splitTagNames(userSlugs);
  const matchedWrap = selectMatchedRules(all, {
    includeBase: false,
    matchTaggedRules: true,
    audienceSlugs: pickAudienceSlug(axes.audience) ? [pickAudienceSlug(axes.audience)] : [],
    modeSlugs: pickModeSlug(axes.mode) ? [pickModeSlug(axes.mode)] : axes.mode,
    slugById
  });
  const matched = (matchedWrap.byTags || []).map((entry) => (
    all.find((r) => r.id === entry.id)
  )).filter(Boolean);

  logger.info(
    `[aiAssistantRulesService] Правила AND по тегам [${userTagIds.join(',')}]: ${matched.length} шт.`
  );
  return matched;
}

async function loadSlugById(allRules, extraIds = []) {
  const ids = new Set(normalizeTagIds(extraIds));
  for (const rule of allRules || []) {
    for (const id of normalizeTagIds(rule.tag_ids || rule.rules?.tag_ids)) ids.add(id);
  }
  const list = [...ids];
  const map = new Map();
  if (!list.length) return map;
  try {
    const userContextService = require('./userContextService');
    const names = await userContextService.getTagNames([...list]);
    if (Array.isArray(names) && names.length === list.length) {
      list.forEach((id, idx) => map.set(id, normalizeSlug(names[idx])));
    } else {
      for (const id of list) {
        const one = await userContextService.getTagNames([id]);
        if (one && one[0]) map.set(id, normalizeSlug(one[0]));
      }
    }
  } catch (err) {
    logger.warn('[aiAssistantRulesService] Не удалось загрузить имена тегов:', err.message);
  }
  return map;
}

/**
 * Собирает объект правил для generateLLMResponse.
 * Гость / user без ЦА: только global (KB base). С ЦА: mode + audience + combo AND, без base.
 */
async function resolveRulesForUser({
  rulesId = null,
  tagIds = [],
  tagNames = [],
  includeBase = true,
  matchTaggedRules = null,
  audienceSlugs = [],
  modeSlugs = []
} = {}) {
  const all = await getAllRules();
  const slugById = await loadSlugById(all, tagIds);
  const applyTagged = matchTaggedRules == null
    ? Boolean(normalizeTagIds(tagIds).length && !includeBase)
    : Boolean(matchTaggedRules);

  let axesAudience = audienceSlugs;
  let axesMode = modeSlugs;
  if ((!axesAudience || !axesAudience.length) && tagNames?.length) {
    const { splitTagNames, pickAudienceSlug, pickModeSlug } = require('./assistantTurnContext');
    const split = splitTagNames(tagNames);
    const aud = pickAudienceSlug(split.audience);
    axesAudience = aud ? [aud] : [];
    axesMode = pickModeSlug(split.mode) ? [pickModeSlug(split.mode)] : (aud ? ['sales'] : []);
  }

  const selected = selectMatchedRules(all, {
    includeBase,
    matchTaggedRules: applyTagged,
    audienceSlugs: axesAudience,
    modeSlugs: axesMode,
    slugById
  });

  let global = null;
  if (includeBase && rulesId) {
    global = await getRuleById(rulesId);
    if (global && selected.byTags.some((r) => r.id === global.id)) {
      global = null;
    }
  }

  logger.info(
    `[aiAssistantRulesService] resolve: tagged=${selected.byTags.length} base=${global ? global.name : 'нет'} includeBase=${includeBase}`
  );

  return {
    byTags: selected.byTags,
    global: global ? toPromptEntry(global) : null
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

  if (rules.global && !(Array.isArray(rules.byTags) && rules.byTags.length)) {
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
  const enriched = enrichRuleRow(rule);
  const full = enriched?.id ? (await getRuleById(enriched.id) || enriched) : enriched;
  try {
    await require('./aiAssistantRulesMirrorService').upsertRuleToTable(full);
  } catch (mirrorErr) {
    logger.error('[aiAssistantRulesService] Зеркало /tables после create:', mirrorErr.message);
  }
  return full;
}

async function updateRule(id, { name, description, rules, tag_ids }, { skipMirror = false } = {}) {
  const existing = await getRuleById(id);
  const merged = existing?.rules
    ? deepMergeRules(existing.rules, rules)
    : rules;
  const payload = normalizeRulesPayload(merged, tag_ids);
  const rule = await encryptedDb.saveData(TABLE, {
    name,
    description,
    rules: payload,
    updated_at: new Date()
  }, {
    id
  });
  const enriched = enrichRuleRow(rule);
  const full = enriched?.id ? (await getRuleById(enriched.id) || enriched) : enriched;
  if (!skipMirror) {
    try {
      await require('./aiAssistantRulesMirrorService').upsertRuleToTable(full);
    } catch (mirrorErr) {
      logger.error('[aiAssistantRulesService] Зеркало /tables после update:', mirrorErr.message);
    }
  }
  return full;
}

async function deleteRule(id, { skipMirror = false } = {}) {
  if (!skipMirror) {
    try {
      await require('./aiAssistantRulesMirrorService').deleteRuleFromTable(id);
    } catch (mirrorErr) {
      logger.warn('[aiAssistantRulesService] Зеркало /tables после delete:', mirrorErr.message);
    }
  }
  await encryptedDb.deleteData(TABLE, { id });
}

module.exports = {
  getAllRules,
  getRuleById,
  getRulesForTagIds,
  resolveRulesForUser,
  selectMatchedRules,
  formatRulesForSystemPrompt,
  normalizeTagIds,
  parseRulesObject,
  createRule,
  updateRule,
  deleteRule,
  deepMergeRules,
  resolveGenerateIfNoRag
};
