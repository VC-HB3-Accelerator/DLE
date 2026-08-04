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
  console.log('[DELETE] Вызван deleteUserById для userId:', userId);
  try {
    // Удаляем в правильном порядке (сначала зависимые таблицы, потом основную)
    
    // 0. Согласия на документы
    console.log('[DELETE] Начинаем удаление consent_logs для userId:', userId);
    const resConsents = await db.getQuery()(
      'DELETE FROM consent_logs WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено consent_logs:', resConsents.rows.length);

    // 0.1 SIWE login audit (если таблица есть)
    try {
      await db.getQuery()(
        'DELETE FROM siwe_login_audit WHERE user_id = $1',
        [userId]
      );
    } catch (e) {
      if (!/siwe_login_audit|does not exist/i.test(String(e.message || e))) {
        throw e;
      }
    }
    
    // 1. Удаляем user_identities
    console.log('[DELETE] Начинаем удаление user_identities для userId:', userId);
    const resIdentities = await db.getQuery()(
      'DELETE FROM user_identities WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_identities:', resIdentities.rows.length);
    
    // 2. Удаляем messages
    console.log('[DELETE] Начинаем удаление messages для userId:', userId);
    const resMessages = await db.getQuery()(
      'DELETE FROM messages WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено messages:', resMessages.rows.length);
    
    // 2.1. Удаляем хеши дедупликации
    console.log('[DELETE] Начинаем удаление message_deduplication для userId:', userId);
    const resDeduplication = await db.getQuery()(
      'DELETE FROM message_deduplication WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено deduplication hashes:', resDeduplication.rows.length);
    
    // 3. Удаляем conversations
    console.log('[DELETE] Начинаем удаление conversations для userId:', userId);
    const resConversations = await db.getQuery()(
      'DELETE FROM conversations WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено conversations:', resConversations.rows.length);
    
    // 4. Удаляем conversation_participants
    console.log('[DELETE] Начинаем удаление conversation_participants для userId:', userId);
    const resParticipants = await db.getQuery()(
      'DELETE FROM conversation_participants WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено conversation_participants:', resParticipants.rows.length);
    
    // 5. Удаляем user_preferences
    console.log('[DELETE] Начинаем удаление user_preferences для userId:', userId);
    const resPreferences = await db.getQuery()(
      'DELETE FROM user_preferences WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_preferences:', resPreferences.rows.length);
    
    // 6. Удаляем verification_codes
    console.log('[DELETE] Начинаем удаление verification_codes для userId:', userId);
    const resCodes = await db.getQuery()(
      'DELETE FROM verification_codes WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено verification_codes:', resCodes.rows.length);
    
    // 7. Удаляем unified_guest_mapping
    console.log('[DELETE] Начинаем удаление unified_guest_mapping для userId:', userId);
    const resGuestMapping = await db.getQuery()(
      'DELETE FROM unified_guest_mapping WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено unified_guest_mapping:', resGuestMapping.rows.length);
    
    // 8. Удаляем user_tag_links
    console.log('[DELETE] Начинаем удаление user_tag_links для userId:', userId);
    const resTagLinks = await db.getQuery()(
      'DELETE FROM user_tag_links WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_tag_links:', resTagLinks.rows.length);
    
    // 9. global_read_status - таблица не существует, пропускаем

    // 9.1. Удаляем файлы контакта
    await userContactFilesService.deleteAllFilesForUser(userId);
    
    // 10. Удаляем самого пользователя
    console.log('[DELETE] Начинаем удаление пользователя из users:', userId);
    const result = await db.getQuery()(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Результат удаления пользователя:', result.rows.length, result.rows);
    
    return result.rows.length;
  } catch (e) {
    console.error('[DELETE] Ошибка при удалении пользователя:', e);
    throw e;
  }
}

module.exports = {
  deleteUserById,
  listConsentsForUser,
  buildConsentsPayload,
  hasGrantedConsentForProvider,
  revokeIdentityConsent,
  deleteConsentsForProvider,
  CONTACT_PROVIDERS,
}; 