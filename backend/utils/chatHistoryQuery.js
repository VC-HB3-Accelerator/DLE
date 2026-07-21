/**
 * Единый фильтр личной истории чата (совпадает для COUNT и SELECT).
 */

const HISTORY_MESSAGE_TYPES = ['user_chat', 'public'];

/**
 * WHERE для COUNT без decrypt: $1 user, $2/$3 types, optional conversation.
 * @param {{ userId: *, conversationId?: * }} opts
 * @param {{ tableAlias?: string }} [options]
 */
function buildPersonalHistoryWhere({ userId, conversationId }, options = {}) {
  const alias = options.tableAlias ? `${options.tableAlias}.` : '';
  const params = [userId, HISTORY_MESSAGE_TYPES[0], HISTORY_MESSAGE_TYPES[1]];
  let whereSql =
    `WHERE ${alias}user_id = $1`
    + ` AND (${alias}message_type = $2 OR ${alias}message_type = $3)`;

  if (conversationId) {
    params.push(conversationId);
    whereSql += ` AND ${alias}conversation_id = $${params.length}`;
  }

  return { whereSql, params };
}

/**
 * SELECT с decrypt: $1 user, $2 encryptionKey, $3/$4 types, optional conv, then LIMIT/OFFSET.
 * WHERE использует алиас `m`.
 */
function buildDecryptSelectParams({
  userId,
  conversationId,
  encryptionKey,
  limit,
  offset
}) {
  const params = [userId, encryptionKey, HISTORY_MESSAGE_TYPES[0], HISTORY_MESSAGE_TYPES[1]];
  let whereSql =
    'WHERE m.user_id = $1'
    + ' AND (m.message_type = $3 OR m.message_type = $4)';

  if (conversationId) {
    params.push(conversationId);
    whereSql += ` AND m.conversation_id = $${params.length}`;
  }

  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 200));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
  params.push(safeLimit);
  const limitIdx = params.length;
  params.push(safeOffset);
  const offsetIdx = params.length;

  return {
    whereSql,
    params,
    limitSql: `LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    limit: safeLimit,
    offset: safeOffset
  };
}

/**
 * @param {any[]} baseParams
 * @param {number} limit
 * @param {number} offset
 */
function appendLimitOffset(baseParams, limit, offset) {
  const params = [...baseParams];
  const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 200));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
  params.push(safeLimit);
  const limitIdx = params.length;
  params.push(safeOffset);
  const offsetIdx = params.length;
  return {
    params,
    limitSql: `LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    limit: safeLimit,
    offset: safeOffset
  };
}

module.exports = {
  HISTORY_MESSAGE_TYPES,
  buildPersonalHistoryWhere,
  buildDecryptSelectParams,
  appendLimitOffset
};
