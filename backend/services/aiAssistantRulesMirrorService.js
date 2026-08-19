/**
 * Зеркало правил в /tables (ТЗ §4.10).
 * Save модалки «Создать правило» на /settings/ai/assistant:
 *   — создаёт одну системную таблицу «Правила ассистента» (RAG=Нет), если её нет;
 *   — upsert строки (не новую таблицу на каждое правило).
 */

const db = require('../db');
const { getEncryptionKey } = require('../utils/encryptionUtils');
const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

const RULES_TABLE_NAMES = ['Правила ассистента', 'Assistant rules'];
const RULES_TABLE_DESC = 'Связь правил чат-агента с тегами (RAG=Нет). Зеркало ai_assistant_rules.';
const TAGS_TABLE_NAMES = ['Теги клиентов', 'Client tags'];
const RAG_NO = 2;

const COL_SPECS = [
  { name: 'Название', type: 'text', purpose: 'assistantRuleName', order: 0 },
  { name: 'Описание', type: 'text', purpose: 'assistantRuleDesc', order: 1 },
  { name: 'Теги', type: 'multiselect-relation', purpose: 'assistantRuleTags', order: 2 },
  { name: 'Промпт правила', type: 'text', purpose: 'assistantRulePrompt', order: 3 },
  { name: 'Temperature', type: 'number', purpose: 'assistantRuleTemperature', order: 4 },
  { name: 'Max tokens', type: 'number', purpose: 'assistantRuleMaxTokens', order: 5 },
  { name: 'rule_id', type: 'text', purpose: 'assistantRuleId', order: 6 }
];

function query() {
  return db.getQuery();
}

async function upsertCell(rowId, columnId, value, key) {
  if (!columnId) return;
  await query()(
    `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
     VALUES ($1, $2, encrypt_text($3, $4))
     ON CONFLICT (row_id, column_id)
     DO UPDATE SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()`,
    [rowId, columnId, value == null ? '' : String(value), key]
  );
}

async function findTableByNames(names) {
  const tables = await encryptedDb.getData('user_tables', {});
  const set = new Set(names);
  return (tables || []).find((t) => set.has(String(t.name || '').trim())) || null;
}

async function findTagsTable() {
  return findTableByNames(TAGS_TABLE_NAMES);
}

async function tagNameColumn(tagsTableId) {
  const cols = await encryptedDb.getData('user_columns', { table_id: tagsTableId });
  return (
    cols.find((c) => c.options?.purpose === 'userTags') ||
    cols.find((c) => c.name === 'Название') ||
    cols.find((c) => c.name === 'Список тегов') ||
    cols.find((c) => c.type === 'text')
  );
}

async function findRulesTable() {
  const byName = await findTableByNames(RULES_TABLE_NAMES);
  if (byName) return byName;
  const tables = await encryptedDb.getData('user_tables', {});
  for (const table of tables || []) {
    const cols = await encryptedDb.getData('user_columns', { table_id: table.id });
    if ((cols || []).some((c) => c.options?.purpose === 'assistantRuleId')) return table;
  }
  return null;
}

async function isRulesMirrorTable(tableId) {
  const id = Number(tableId);
  if (!id) return false;
  const found = await findRulesTable();
  return Boolean(found && Number(found.id) === id);
}

async function isRagSourceTable(tableId) {
  const { rows } = await query()(
    'SELECT is_rag_source_id FROM user_tables WHERE id = $1',
    [Number(tableId)]
  );
  return Number(rows[0]?.is_rag_source_id) === 1;
}

async function ensureRulesTable(key) {
  const existing = await findRulesTable();
  if (existing) {
    if (Number(existing.is_rag_source_id || existing.is_rag_source) === 1) {
      await query()(
        'UPDATE user_tables SET is_rag_source_id = $2 WHERE id = $1',
        [existing.id, RAG_NO]
      );
    }
    return existing.id;
  }
  const created = await query()(
    `INSERT INTO user_tables (name_encrypted, description_encrypted, is_rag_source_id)
     VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3)
     RETURNING id`,
    [RULES_TABLE_NAMES[0], RULES_TABLE_DESC, RAG_NO, key]
  );
  const tableId = created.rows[0].id;
  logger.info(`[assistantRulesMirror] Создана таблица «${RULES_TABLE_NAMES[0]}» id=${tableId} RAG=Нет`);
  return tableId;
}

async function ensureRulesColumns(tableId, key) {
  const tagsTable = await findTagsTable();
  const nameCol = tagsTable ? await tagNameColumn(tagsTable.id) : null;
  const cols = await encryptedDb.getData('user_columns', { table_id: tableId });
  const byPurpose = {};
  const byName = {};
  for (const col of cols || []) {
    if (col.options?.purpose) byPurpose[col.options.purpose] = col;
    byName[col.name] = col;
  }

  for (const spec of COL_SPECS) {
    const existing = byPurpose[spec.purpose] || byName[spec.name];
    if (existing) {
      if (spec.purpose === 'assistantRuleTags' && tagsTable && nameCol) {
        const opts = { ...(existing.options || {}), purpose: spec.purpose, relatedTableId: tagsTable.id, relatedColumnId: nameCol.id };
        await query()(
          'UPDATE user_columns SET options = $2 WHERE id = $1',
          [existing.id, JSON.stringify(opts)]
        );
      }
      continue;
    }
    const options = { purpose: spec.purpose };
    if (spec.purpose === 'assistantRuleTags' && tagsTable && nameCol) {
      options.relatedTableId = tagsTable.id;
      options.relatedColumnId = nameCol.id;
    }
    await query()(
      `INSERT INTO user_columns
         (table_id, name_encrypted, type_encrypted, placeholder_encrypted, "order", placeholder, options)
       VALUES ($1, encrypt_text($2, $7), encrypt_text($3, $7), encrypt_text($6, $7), $4, $5, $8)`,
      [tableId, spec.name, spec.type, spec.order, spec.purpose, spec.purpose, key, JSON.stringify(options)]
    );
  }

  const fresh = await encryptedDb.getData('user_columns', { table_id: tableId });
  const map = {};
  for (const col of fresh || []) {
    if (col.options?.purpose) map[col.options.purpose] = col.id;
  }
  return { colMap: map, tagsTableId: tagsTable?.id || null };
}

async function findRowByRuleId(tableId, ruleIdColId, ruleId, key) {
  if (!ruleIdColId || ruleId == null) return null;
  const res = await query()(
    `SELECT r.id AS row_id
       FROM user_rows r
       JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = $2
      WHERE r.table_id = $1
        AND decrypt_text(c.value_encrypted, $3) = $4
      LIMIT 1`,
    [tableId, ruleIdColId, key, String(ruleId)]
  );
  return res.rows[0]?.row_id || null;
}

async function upsertRuleMirrorRow(tableId, colMap, tagsTableId, rule, key) {
  let rowId = await findRowByRuleId(tableId, colMap.assistantRuleId, rule.id, key);
  if (!rowId) {
    const ins = await query()(
      'INSERT INTO user_rows (table_id) VALUES ($1) RETURNING id',
      [tableId]
    );
    rowId = ins.rows[0].id;
  }
  const payload = rule.rules && typeof rule.rules === 'object' ? rule.rules : {};
  await upsertCell(rowId, colMap.assistantRuleName, rule.name || '', key);
  await upsertCell(rowId, colMap.assistantRuleDesc, rule.description || '', key);
  await upsertCell(rowId, colMap.assistantRulePrompt, payload.system_prompt || '', key);
  await upsertCell(rowId, colMap.assistantRuleTemperature, payload.temperature != null ? payload.temperature : '', key);
  await upsertCell(rowId, colMap.assistantRuleMaxTokens, payload.max_tokens != null ? payload.max_tokens : '', key);
  await upsertCell(rowId, colMap.assistantRuleId, String(rule.id), key);

  if (colMap.assistantRuleTags) {
    const tagIds = (rule.tag_ids || payload.tag_ids || [])
      .map((id) => parseInt(id, 10))
      .filter((n) => n > 0);
    await query()(
      'DELETE FROM user_table_relations WHERE from_row_id = $1 AND column_id = $2',
      [rowId, colMap.assistantRuleTags]
    );
    for (const toRowId of tagIds) {
      await query()(
        `INSERT INTO user_table_relations (from_row_id, column_id, to_table_id, to_row_id)
         VALUES ($1, $2, $3, $4)`,
        [rowId, colMap.assistantRuleTags, tagsTableId, toRowId]
      );
    }
  }
  return rowId;
}

/**
 * Первое Save модалки: создать таблицу (если нет) и upsert строку правила.
 */
async function upsertRuleToTable(rule) {
  if (!rule || rule.id == null) return null;
  const key = getEncryptionKey();
  const tableId = await ensureRulesTable(key);
  const { colMap, tagsTableId } = await ensureRulesColumns(tableId, key);
  const rowId = await upsertRuleMirrorRow(tableId, colMap, tagsTableId, rule, key);
  try {
    const { broadcastTableUpdate } = require('../wsHub');
    broadcastTableUpdate(tableId);
  } catch (_) { /* ignore */ }
  logger.info(`[assistantRulesMirror] upsert rule_id=${rule.id} → table=${tableId} row=${rowId}`);
  return { tableId, rowId };
}

async function deleteRuleFromTable(ruleId) {
  const key = getEncryptionKey();
  const table = await findRulesTable();
  if (!table || ruleId == null) return;
  const cols = await encryptedDb.getData('user_columns', { table_id: table.id });
  const idCol = (cols || []).find((c) => c.options?.purpose === 'assistantRuleId');
  if (!idCol) return;
  const rowId = await findRowByRuleId(table.id, idCol.id, ruleId, key);
  if (!rowId) return;
  await query()('DELETE FROM user_table_relations WHERE from_row_id = $1', [rowId]);
  await query()('DELETE FROM user_cell_values WHERE row_id = $1', [rowId]);
  await query()('DELETE FROM user_rows WHERE id = $1', [rowId]);
  try {
    const { broadcastTableUpdate } = require('../wsHub');
    broadcastTableUpdate(table.id);
  } catch (_) { /* ignore */ }
}

async function readCell(rowId, columnId, key) {
  if (!columnId) return '';
  const res = await query()(
    'SELECT decrypt_text(value_encrypted, $2) AS value FROM user_cell_values WHERE row_id = $1 AND column_id = $2',
    [rowId, columnId, key]
  );
  return res.rows[0]?.value != null ? String(res.rows[0].value) : '';
}

/**
 * Правка в /tables → обратно в ai_assistant_rules.
 */
async function syncTableRowToRule(tableId, rowId) {
  if (!(await isRulesMirrorTable(tableId))) return null;
  const key = getEncryptionKey();
  const cols = await encryptedDb.getData('user_columns', { table_id: tableId });
  const byPurpose = {};
  for (const col of cols || []) {
    if (col.options?.purpose) byPurpose[col.options.purpose] = col.id;
  }
  const ruleIdRaw = await readCell(rowId, byPurpose.assistantRuleId, key);
  const ruleId = parseInt(ruleIdRaw, 10);
  if (!ruleId) return null;

  const rulesService = require('./aiAssistantRulesService');
  const existing = await rulesService.getRuleById(ruleId);
  if (!existing) return null;

  const tagIds = [];
  if (byPurpose.assistantRuleTags) {
    const rels = await query()(
      'SELECT to_row_id FROM user_table_relations WHERE from_row_id = $1 AND column_id = $2',
      [rowId, byPurpose.assistantRuleTags]
    );
    for (const r of rels.rows || []) {
      const id = parseInt(r.to_row_id, 10);
      if (id > 0) tagIds.push(id);
    }
  }

  const tempRaw = await readCell(rowId, byPurpose.assistantRuleTemperature, key);
  const maxRaw = await readCell(rowId, byPurpose.assistantRuleMaxTokens, key);
  const payload = {
    ...(existing.rules || {}),
    system_prompt: await readCell(rowId, byPurpose.assistantRulePrompt, key),
    tag_ids: tagIds
  };
  if (tempRaw !== '') payload.temperature = Number(tempRaw);
  if (maxRaw !== '') payload.max_tokens = Number(maxRaw);

  await rulesService.updateRule(ruleId, {
    name: await readCell(rowId, byPurpose.assistantRuleName, key),
    description: await readCell(rowId, byPurpose.assistantRuleDesc, key),
    rules: payload,
    tag_ids: tagIds
  }, { skipMirror: true });
  logger.info(`[assistantRulesMirror] sync /tables row=${rowId} → rule_id=${ruleId}`);
  return ruleId;
}

async function deleteRuleIfMirrorRow(tableId, rowId) {
  if (!(await isRulesMirrorTable(tableId))) return;
  const key = getEncryptionKey();
  const cols = await encryptedDb.getData('user_columns', { table_id: tableId });
  const idCol = (cols || []).find((c) => c.options?.purpose === 'assistantRuleId');
  if (!idCol) return;
  const ruleIdRaw = await readCell(rowId, idCol.id, key);
  const ruleId = parseInt(ruleIdRaw, 10);
  if (!ruleId) return;
  const rulesService = require('./aiAssistantRulesService');
  await rulesService.deleteRule(ruleId, { skipMirror: true });
}

async function mirrorAllExistingRules() {
  const key = getEncryptionKey();
  const tableId = await ensureRulesTable(key);
  const { colMap, tagsTableId } = await ensureRulesColumns(tableId, key);
  const rulesService = require('./aiAssistantRulesService');
  const all = await rulesService.getAllRules();
  for (const rule of all || []) {
    await upsertRuleMirrorRow(tableId, colMap, tagsTableId, rule, key);
  }
  return { tableId, count: (all || []).length };
}

module.exports = {
  RULES_TABLE_NAMES,
  upsertRuleToTable,
  deleteRuleFromTable,
  syncTableRowToRule,
  deleteRuleIfMirrorRow,
  isRulesMirrorTable,
  isRagSourceTable,
  findRulesTable,
  mirrorAllExistingRules
};
