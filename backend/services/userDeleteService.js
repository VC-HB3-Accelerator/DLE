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

const db = require('../db');
const userContactFilesService = require('./userContactFilesService');

const CONTACT_PROVIDERS = ['email', 'telegram', 'wallet'];

function consentChannelMatchSql(provider) {
  if (provider === 'email') return `channel = 'email'`;
  if (provider === 'telegram') return `channel = 'telegram'`;
  // wallet / SIWE web
  return `channel IN ('web', 'wallet')`;
}

/**
 * Есть ли granted-согласие для провайдера идентичности контакта.
 */
async function hasGrantedConsentForProvider(userId, provider, walletAddress = null) {
  const params = [userId];
  let extra = '';
  if (provider === 'wallet' && walletAddress) {
    params.push(String(walletAddress).toLowerCase());
    extra = ` OR LOWER(wallet_address) = LOWER($${params.length})`;
  }
  const { rows } = await db.getQuery()(
    `SELECT 1 FROM consent_logs
     WHERE user_id = $1 AND status = 'granted'
       AND (${consentChannelMatchSql(provider)}${extra})
     LIMIT 1`,
    params
  );
  return rows.length > 0;
}

async function listConsentsForUser(userId) {
  const { rows } = await db.getQuery()(
    `SELECT id, consent_type, document_title, document_id, status, signed_at, channel, wallet_address
     FROM consent_logs
     WHERE user_id = $1
     ORDER BY signed_at DESC NULLS LAST, id DESC`,
    [userId]
  );
  return rows;
}

function buildConsentsPayload(items, walletAddress, privacyUrl) {
  const byProvider = {
    email: { hasGranted: false, items: [] },
    telegram: { hasGranted: false, items: [] },
    wallet: { hasGranted: false, items: [] },
  };
  for (const row of items) {
    let provider = null;
    if (row.channel === 'email') provider = 'email';
    else if (row.channel === 'telegram') provider = 'telegram';
    else if (row.channel === 'web' || row.channel === 'wallet') provider = 'wallet';
    else if (
      walletAddress
      && row.wallet_address
      && String(row.wallet_address).toLowerCase() === String(walletAddress).toLowerCase()
    ) {
      provider = 'wallet';
    }
    if (!provider || !byProvider[provider]) continue;
    byProvider[provider].items.push(row);
    if (row.status === 'granted') byProvider[provider].hasGranted = true;
  }
  return { privacyUrl, byProvider, items };
}

async function deleteConsentsForProvider(userId, provider, walletAddress = null) {
  const params = [userId];
  let walletClause = '';
  if (provider === 'wallet' && walletAddress) {
    params.push(String(walletAddress).toLowerCase());
    walletClause = ` OR LOWER(wallet_address) = LOWER($${params.length})`;
  }
  const { rowCount } = await db.getQuery()(
    `DELETE FROM consent_logs
     WHERE user_id = $1
       AND (${consentChannelMatchSql(provider)}${walletClause})`,
    params
  );
  return rowCount || 0;
}

/**
 * Отозвать согласие канала = удалить identity; если последняя — удалить user.
 */
async function revokeIdentityConsent({ userId, provider, privacyUrl }) {
  if (!CONTACT_PROVIDERS.includes(provider)) {
    return { success: false, error: 'Invalid provider' };
  }

  const identityService = require('./identity-service');
  const identities = await identityService.getUserIdentities(userId);
  const contactProviders = identities.filter((i) => CONTACT_PROVIDERS.includes(i.provider));
  const target = contactProviders.find((i) => i.provider === provider);
  if (!target) {
    return { success: false, error: 'Identity not found' };
  }

  const wallet = contactProviders.find((i) => i.provider === 'wallet')?.provider_id || null;

  const granted = await hasGrantedConsentForProvider(userId, provider, wallet);
  if (!granted) {
    return { success: false, error: 'No active consent for this channel' };
  }

  await deleteConsentsForProvider(userId, provider, wallet);

  const remaining = contactProviders.filter((i) => i.provider !== provider);
  if (remaining.length === 0) {
    const deleted = await deleteUserById(userId);
    return {
      success: deleted > 0,
      deletedUser: true,
      deletedProvider: provider,
      privacyUrl,
    };
  }

  const del = await identityService.deleteIdentity(userId, provider, target.provider_id);
  if (!del.success) {
    return { success: false, error: del.error || 'Failed to delete identity' };
  }
  return {
    success: true,
    deletedUser: false,
    deletedProvider: provider,
    privacyUrl,
  };
}

async function deleteUserById(userId) {
  const result = await deleteUsersByIds([userId]);
  return result.deleted;
}

/**
 * Пакетное удаление контактов (один набор SQL на все id).
 */
async function deleteUsersByIds(userIds) {
  const ids = [...new Set(
    (userIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
  if (!ids.length) {
    return { deleted: 0, ids: [] };
  }

  console.log('[DELETE] bulk deleteUsersByIds count=', ids.length);

  try {
    await userContactFilesService.deleteAllFilesForUsers(ids);

    const dependentTables = [
      'consent_logs',
      'user_identities',
      'messages',
      'message_deduplication',
      'conversations',
      'conversation_participants',
      'user_preferences',
      'verification_codes',
      'unified_guest_mapping',
      'user_tag_links',
    ];

    for (const table of dependentTables) {
      await db.getQuery()(
        `DELETE FROM ${table} WHERE user_id = ANY($1::int[])`,
        [ids]
      );
    }

    try {
      await db.getQuery()(
        'DELETE FROM siwe_login_audit WHERE user_id = ANY($1::int[])',
        [ids]
      );
    } catch (e) {
      if (!/siwe_login_audit|does not exist/i.test(String(e.message || e))) {
        throw e;
      }
    }

    const result = await db.getQuery()(
      'DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id',
      [ids]
    );

    console.log('[DELETE] bulk done deleted=', result.rows.length);
    return {
      deleted: result.rows.length,
      ids: result.rows.map((r) => Number(r.id)),
    };
  } catch (e) {
    console.error('[DELETE] Ошибка bulk-удаления:', e);
    throw e;
  }
}

module.exports = {
  deleteUserById,
  deleteUsersByIds,
  listConsentsForUser,
  buildConsentsPayload,
  hasGrantedConsentForProvider,
  revokeIdentityConsent,
  deleteConsentsForProvider,
  CONTACT_PROVIDERS,
};
