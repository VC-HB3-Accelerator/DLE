/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Аудит SIWE-входа: fact-log + шифрованный hex, TTL 2 года.
 * См. docs.ru/back-docs/TZ_SIWE_LOGIN_AUDIT.ru.md
 */

const crypto = require('crypto');
const db = require('../db');
const encryptionUtils = require('../utils/encryptionUtils');
const logger = require('../utils/logger');

const TTL_YEARS = 2;
const UA_MAX = 512;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function hashResources(resources) {
  const list = Array.isArray(resources) ? [...resources].map(String).sort() : [];
  return sha256Hex(JSON.stringify(list));
}

async function purgeExpired() {
  try {
    const { rowCount } = await db.getQuery()(
      `DELETE FROM siwe_login_audit WHERE expires_at < NOW()`
    );
    if (rowCount > 0) {
      logger.info(`[siweLoginAudit] purged ${rowCount} expired row(s)`);
    }
  } catch (err) {
    logger.warn(`[siweLoginAudit] purge failed: ${err.message}`);
  }
}

/**
 * @param {object} params
 * @param {number|null} params.userId
 * @param {string} params.address
 * @param {number|null} params.chainId
 * @param {string|Date|null} params.issuedAt
 * @param {string} params.statement
 * @param {string[]} params.resources
 * @param {string} params.messageText - SiweMessage.prepareMessage()
 * @param {string} params.signature - hex signature
 * @param {string|null} params.ipAddress
 * @param {string|null} params.userAgent
 */
async function record(params = {}) {
  await purgeExpired();

  const address = String(params.address || '').trim();
  const signature = String(params.signature || '').trim();
  const statement = String(params.statement || '');
  const messageText = String(params.messageText || '');
  const resources = Array.isArray(params.resources) ? params.resources : [];

  if (!address || !signature || !messageText) {
    logger.warn('[siweLoginAudit] record skipped: missing address/signature/message');
    return null;
  }

  const encryptionKey = encryptionUtils.getEncryptionKey();
  const userAgent = params.userAgent
    ? String(params.userAgent).slice(0, UA_MAX)
    : null;

  let issuedAt = null;
  if (params.issuedAt) {
    const d = new Date(params.issuedAt);
    if (!Number.isNaN(d.getTime())) issuedAt = d.toISOString();
  }

  const chainId = Number.isFinite(Number(params.chainId))
    ? Number(params.chainId)
    : null;

  const userId = params.userId != null && Number.isFinite(Number(params.userId))
    ? Number(params.userId)
    : null;

  try {
    const { rows } = await db.getQuery()(
      `INSERT INTO siwe_login_audit (
         user_id, address, chain_id, issued_at,
         statement_hash, resources_hash, message_hash,
         signature_encrypted, ip_address, user_agent,
         created_at, expires_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, $7,
         encrypt_text($8, $9), $10, $11,
         NOW(), NOW() + ($12::text || ' years')::interval
       )
       RETURNING id, created_at, expires_at`,
      [
        userId,
        address,
        chainId,
        issuedAt,
        sha256Hex(statement),
        hashResources(resources),
        sha256Hex(messageText),
        signature,
        encryptionKey,
        params.ipAddress || null,
        userAgent,
        String(TTL_YEARS),
      ]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error(`[siweLoginAudit] record failed: ${err.message}`);
    return null;
  }
}

/**
 * Список для editor (с расшифровкой signature).
 */
async function listForEditor({ limit = 50, offset = 0, address = null } = {}) {
  await purgeExpired();

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const encryptionKey = encryptionUtils.getEncryptionKey();

  const addr = address && String(address).trim() ? String(address).trim() : null;

  const listParams = addr
    ? [encryptionKey, addr, lim, off]
    : [encryptionKey, lim, off];

  const whereSql = addr ? 'WHERE LOWER(address) = LOWER($2)' : '';
  const limitSql = addr ? 'LIMIT $3 OFFSET $4' : 'LIMIT $2 OFFSET $3';

  const { rows } = await db.getQuery()(
    `SELECT
       id, user_id, address, chain_id, issued_at,
       statement_hash, resources_hash, message_hash,
       decrypt_text(signature_encrypted, $1) AS signature,
       ip_address, user_agent, created_at, expires_at
     FROM siwe_login_audit
     ${whereSql}
     ORDER BY created_at DESC
     ${limitSql}`,
    listParams
  );

  const countParams = addr ? [addr] : [];
  const countRes = await db.getQuery()(
    `SELECT COUNT(*)::int AS total FROM siwe_login_audit ${addr ? 'WHERE LOWER(address) = LOWER($1)' : ''}`,
    countParams
  );

  return {
    items: rows,
    total: countRes.rows[0]?.total ?? rows.length,
    limit: lim,
    offset: off,
  };
}

module.exports = {
  TTL_YEARS,
  record,
  listForEditor,
  purgeExpired,
  sha256Hex,
  hashResources,
};
