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

// console.log('[identity-service] loaded');

const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const logger = require('../utils/logger');
const encryptionUtils = require('../utils/encryptionUtils');
const { ethers } = require('ethers');
const { getLinkedWallet } = require('./wallet-service');
const { broadcastContactsUpdate } = require('../wsHub');

const CONTACT_IDENTITY_PROVIDERS = ['email', 'phone', 'website', 'telegram', 'wallet'];
const MULTI_ROW_PROVIDERS = new Set(['email', 'phone', 'website']);
const LABEL_MAX_LEN = 80;

const IDENTITY_PROVIDER_LABELS = {
  email: 'email',
  phone: 'телефон',
  website: 'сайт',
  telegram: 'Telegram',
  wallet: 'кошелёк',
};

/**
 * Сервис для работы с идентификаторами пользователей
 */
class IdentityService {
  /**
   * Нормализует значения идентификаторов (приводит к нижнему регистру где нужно)
   * @param {string} provider - Тип идентификатора
   * @param {string} providerId - Значение идентификатора
   * @returns {object} - Нормализованные значения
   */
  normalizeIdentity(provider, providerId) {
    if (!provider || !providerId) {
      return { provider, providerId };
    }

    const normalizedProvider = provider.toLowerCase();
    const normalizedProviderId = this.normalizeContactIdentityValue(normalizedProvider, providerId);

    return {
      provider: normalizedProvider,
      providerId: normalizedProviderId,
    };
  }

  getIdentityProviderLabel(provider) {
    return IDENTITY_PROVIDER_LABELS[provider?.toLowerCase()] || provider;
  }

  normalizeContactIdentityValue(provider, value) {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return null;
    }

    const normalizedProvider = provider.toLowerCase();

    if (normalizedProvider === 'email') {
      return trimmed.toLowerCase();
    }

    if (normalizedProvider === 'wallet') {
      try {
        return ethers.getAddress(trimmed).toLowerCase();
      } catch {
        return trimmed.toLowerCase();
      }
    }

    if (normalizedProvider === 'telegram') {
      return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    }

    if (normalizedProvider === 'phone') {
      // Keep leading +, strip spaces/dashes/parens
      const hasPlus = trimmed.startsWith('+');
      const digits = trimmed.replace(/[^\d]/g, '');
      if (!digits) return null;
      return hasPlus ? `+${digits}` : digits;
    }

    if (normalizedProvider === 'website') {
      const { normalizeWebsiteUrl } = require('../utils/contactImportMulti');
      return normalizeWebsiteUrl(trimmed);
    }

    return trimmed;
  }

  getIdentityLookupVariants(provider, value) {
    const normalized = this.normalizeContactIdentityValue(provider, value);
    if (!normalized) {
      return [];
    }

    const normalizedProvider = provider.toLowerCase();
    if (normalizedProvider === 'telegram') {
      return [...new Set([normalized, `@${normalized}`])];
    }

    return [normalized];
  }

  validateContactIdentityValue(provider, value) {
    const normalized = this.normalizeContactIdentityValue(provider, value);
    if (!normalized) {
      return { valid: false, error: 'Пустое значение идентификатора' };
    }

    const normalizedProvider = provider.toLowerCase();

    if (normalizedProvider === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalized)) {
        return { valid: false, error: 'Некорректный формат email' };
      }
    }

    if (normalizedProvider === 'wallet') {
      try {
        ethers.getAddress(normalized);
      } catch {
        return { valid: false, error: 'Некорректный адрес кошелька' };
      }
    }

    if (normalizedProvider === 'telegram') {
      if (!/^[a-zA-Z0-9_]{3,}$/.test(normalized) && !/^\d+$/.test(normalized)) {
        return { valid: false, error: 'Некорректный идентификатор Telegram' };
      }
    }

    if (normalizedProvider === 'phone') {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) {
        return { valid: false, error: 'Некорректный номер телефона' };
      }
    }

    if (normalizedProvider === 'website') {
      if (!normalized) {
        return { valid: false, error: 'Некорректный URL сайта' };
      }
    }

    return { valid: true, value: normalized };
  }

  clampLabel(label) {
    return String(label || '').trim().slice(0, LABEL_MAX_LEN);
  }

  isMultiRowProvider(provider) {
    return MULTI_ROW_PROVIDERS.has(String(provider || '').toLowerCase());
  }

  mapIdentityRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      provider: row.provider,
      provider_id: row.provider_id,
      value: row.provider_id,
      label: row.label != null ? String(row.label) : '',
      is_primary: Boolean(row.is_primary),
      created_at: row.created_at,
      updated_at: row.updated_at || null
    };
  }

  async listIdentitiesRaw(userId, provider = null) {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const params = [userId, encryptionKey];
    let sql = `
      SELECT
        id,
        user_id,
        decrypt_text(provider_encrypted, $2) AS provider,
        decrypt_text(provider_id_encrypted, $2) AS provider_id,
        COALESCE(label, '') AS label,
        COALESCE(is_primary, false) AS is_primary,
        created_at
      FROM user_identities
      WHERE user_id = $1
    `;
    if (provider) {
      params.push(String(provider).toLowerCase());
      sql += ` AND provider_encrypted = encrypt_text($${params.length}, $2)`;
    }
    sql += ' ORDER BY is_primary DESC, id ASC';
    const { rows } = await db.getQuery()(sql, params);
    return rows.map((r) => this.mapIdentityRow(r));
  }

  async findPrimaryIdentity(userId, provider) {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows } = await db.getQuery()(
      `SELECT
         id, user_id,
         decrypt_text(provider_encrypted, $3) AS provider,
         decrypt_text(provider_id_encrypted, $3) AS provider_id,
         COALESCE(label, '') AS label,
         COALESCE(is_primary, false) AS is_primary,
         created_at
       FROM user_identities
       WHERE user_id = $1
         AND provider_encrypted = encrypt_text($2, $3)
         AND is_primary = true
       ORDER BY id ASC
       LIMIT 1`,
      [userId, String(provider).toLowerCase(), encryptionKey]
    );
    if (rows[0]) return this.mapIdentityRow(rows[0]);

    // Fallback: oldest row (and heal primary)
    const list = await this.listIdentitiesRaw(userId, provider);
    if (!list.length) return null;
    await this.setPrimaryIdentity(userId, list[0].id, { silent: true });
    return this.mapIdentityRow({ ...list[0], is_primary: true });
  }

  async getPrimaryIdentityValue(userId, provider) {
    const row = await this.findPrimaryIdentity(userId, provider);
    return row?.provider_id || null;
  }

  async clearPrimaryFlags(userId, provider, client = null) {
    const q = client || db.getQuery();
    const encryptionKey = encryptionUtils.getEncryptionKey();
    await q(
      `UPDATE user_identities
       SET is_primary = false
       WHERE user_id = $1
         AND provider_encrypted = encrypt_text($2, $3)
         AND is_primary = true`,
      [userId, String(provider).toLowerCase(), encryptionKey]
    );
  }

  async setPrimaryIdentity(userId, identityId, { silent = false } = {}) {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows } = await db.getQuery()(
      `SELECT
         id, user_id,
         decrypt_text(provider_encrypted, $2) AS provider,
         decrypt_text(provider_id_encrypted, $2) AS provider_id,
         COALESCE(label, '') AS label,
         COALESCE(is_primary, false) AS is_primary,
         created_at
       FROM user_identities
       WHERE id = $1 AND user_id = $3`,
      [identityId, encryptionKey, userId]
    );
    if (!rows[0]) {
      return { success: false, error: 'Идентификатор не найден' };
    }
    const provider = rows[0].provider;
    if (!this.isMultiRowProvider(provider) && provider !== 'telegram' && provider !== 'wallet') {
      return { success: false, error: 'Нельзя назначить основным' };
    }

    const client = await db.getQuery();
    // Use transactional if pool supports; fallback sequential
    await this.clearPrimaryFlags(userId, provider);
    await db.getQuery()(
      `UPDATE user_identities SET is_primary = true WHERE id = $1 AND user_id = $2`,
      [identityId, userId]
    );
    if (!silent) {
      logger.info(`[IdentityService] Primary ${provider} for user ${userId} → identity ${identityId}`);
    }
    if (provider === 'website') {
      await this.syncPrimaryWebsiteToCrmLink(userId);
    }
    return { success: true, identity: this.mapIdentityRow({ ...rows[0], is_primary: true }) };
  }

  async addContactIdentity(userId, provider, value, { label = '', makePrimary = false } = {}) {
    const validation = this.validateContactIdentityValue(provider, value);
    if (!validation.valid) return { success: false, error: validation.error };
    const normalizedProvider = String(provider).toLowerCase();
    if (!this.isMultiRowProvider(normalizedProvider)) {
      return { success: false, error: 'Добавление строки поддерживается только для email, phone и website' };
    }

    const availability = await this.assertIdentityAvailable(normalizedProvider, validation.value, userId);
    if (!availability.available) return { success: false, error: availability.error };

    const existing = (await this.listIdentitiesRaw(userId, normalizedProvider))
      .find((r) => r.provider_id === validation.value);
    if (existing) {
      if (label !== undefined && label !== null) {
        await db.getQuery()(
          `UPDATE user_identities SET label = $1 WHERE id = $2 AND user_id = $3`,
          [this.clampLabel(label), existing.id, userId]
        );
      }
      if (makePrimary) await this.setPrimaryIdentity(userId, existing.id);
      return { success: true, identity: existing, existed: true };
    }

    const hasPrimary = Boolean(await this.findPrimaryIdentity(userId, normalizedProvider));
    const isPrimary = makePrimary || !hasPrimary;
    const encryptionKey = encryptionUtils.getEncryptionKey();
    if (isPrimary && hasPrimary) {
      await this.clearPrimaryFlags(userId, normalizedProvider);
    }

    const { rows } = await db.getQuery()(
      `INSERT INTO user_identities (
         user_id, provider_encrypted, provider_id_encrypted, label, is_primary, created_at
       ) VALUES (
         $1, encrypt_text($2, $5), encrypt_text($3, $5), $4, $6, NOW()
       )
       RETURNING id, user_id, created_at`,
      [
        userId,
        normalizedProvider,
        validation.value,
        this.clampLabel(label),
        encryptionKey,
        isPrimary
      ]
    );

    const identity = this.mapIdentityRow({
      ...rows[0],
      provider: normalizedProvider,
      provider_id: validation.value,
      label: this.clampLabel(label),
      is_primary: isPrimary
    });
    if (normalizedProvider === 'website') {
      await this.syncPrimaryWebsiteToCrmLink(userId);
    }
    return { success: true, identity };
  }

  async updateContactIdentityRow(userId, identityId, patch = {}) {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows } = await db.getQuery()(
      `SELECT
         id, user_id,
         decrypt_text(provider_encrypted, $2) AS provider,
         decrypt_text(provider_id_encrypted, $2) AS provider_id,
         COALESCE(label, '') AS label,
         COALESCE(is_primary, false) AS is_primary,
         created_at
       FROM user_identities
       WHERE id = $1 AND user_id = $3`,
      [identityId, encryptionKey, userId]
    );
    if (!rows[0]) return { success: false, error: 'Идентификатор не найден' };
    const current = this.mapIdentityRow(rows[0]);
    if (!this.isMultiRowProvider(current.provider)) {
      return { success: false, error: 'Редактирование строки только для email/phone/website' };
    }

    let nextValue = current.provider_id;
    if (patch.value !== undefined) {
      const validation = this.validateContactIdentityValue(current.provider, patch.value);
      if (!validation.valid) return { success: false, error: validation.error };
      const availability = await this.assertIdentityAvailable(current.provider, validation.value, userId);
      if (!availability.available) return { success: false, error: availability.error };
      nextValue = validation.value;
    }

    const nextLabel = patch.label !== undefined ? this.clampLabel(patch.label) : current.label;

    await db.getQuery()(
      `UPDATE user_identities SET
         provider_id_encrypted = encrypt_text($1, $4),
         label = $2
       WHERE id = $3 AND user_id = $5`,
      [nextValue, nextLabel, identityId, encryptionKey, userId]
    );

    if (patch.is_primary === true) {
      await this.setPrimaryIdentity(userId, identityId);
    }

    if (current.provider === 'website') {
      await this.syncPrimaryWebsiteToCrmLink(userId);
    }

    const refreshed = (await this.listIdentitiesRaw(userId, current.provider))
      .find((r) => Number(r.id) === Number(identityId));
    return { success: true, identity: refreshed };
  }

  async deleteContactIdentityRow(userId, identityId) {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows } = await db.getQuery()(
      `SELECT
         id, user_id,
         decrypt_text(provider_encrypted, $2) AS provider,
         decrypt_text(provider_id_encrypted, $2) AS provider_id,
         COALESCE(is_primary, false) AS is_primary
       FROM user_identities
       WHERE id = $1 AND user_id = $3`,
      [identityId, encryptionKey, userId]
    );
    if (!rows[0]) return { success: false, error: 'Идентификатор не найден' };
    const provider = rows[0].provider;
    const wasPrimary = Boolean(rows[0].is_primary);

    await db.getQuery()(
      `DELETE FROM user_identities WHERE id = $1 AND user_id = $2`,
      [identityId, userId]
    );

    if (wasPrimary && this.isMultiRowProvider(provider)) {
      const rest = await this.listIdentitiesRaw(userId, provider);
      if (rest.length) {
        await this.setPrimaryIdentity(userId, rest[0].id, { silent: true });
      }
    }

    if (provider === 'website') {
      await this.syncPrimaryWebsiteToCrmLink(userId);
    }

    return { success: true };
  }

  async ensureWebsiteFromLink(userId) {
    const existing = await this.listIdentitiesRaw(userId, 'website');
    if (existing.length) return;
    try {
      const userContactFilesService = require('./userContactFilesService');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      const map = await userContactFilesService.getContactExtrasMapForUserIds([Number(userId)], encryptionKey);
      const link = map[Number(userId)]?.link;
      if (!link) return;
      await this.addContactIdentity(userId, 'website', link, { makePrimary: true, label: '' });
    } catch (error) {
      logger.warn(`[IdentityService] ensureWebsiteFromLink user ${userId}: ${error.message}`);
    }
  }

  async buildContactIdentityPayload(userId) {
    await this.ensureWebsiteFromLink(userId);
    const all = await this.listIdentitiesRaw(userId);
    const emails = all.filter((r) => r.provider === 'email');
    const phones = all.filter((r) => r.provider === 'phone');
    const websites = all.filter((r) => r.provider === 'website');
    const telegram = all.find((r) => r.provider === 'telegram')?.provider_id || null;
    const wallet = all.find((r) => r.provider === 'wallet')?.provider_id || null;
    const primaryEmail = emails.find((r) => r.is_primary)?.provider_id
      || emails[0]?.provider_id
      || null;
    const primaryPhone = phones.find((r) => r.is_primary)?.provider_id
      || phones[0]?.provider_id
      || null;
    const primaryWebsite = websites.find((r) => r.is_primary)?.provider_id
      || websites[0]?.provider_id
      || null;
    return {
      emails,
      phones,
      websites,
      email: primaryEmail,
      phone: primaryPhone,
      website: primaryWebsite,
      telegram,
      wallet
    };
  }

  async syncPrimaryWebsiteToCrmLink(userId) {
    try {
      const userContactFilesService = require('./userContactFilesService');
      const primary = await this.getPrimaryIdentityValue(userId, 'website');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      await userContactFilesService.updateContactExtras(userId, { link: primary || null }, encryptionKey);
    } catch (error) {
      logger.warn(`[IdentityService] sync website→link user ${userId}: ${error.message}`);
    }
  }

  /**
   * Сохраняет идентификатор пользователя в базу данных
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора (wallet, email, telegram)
   * @param {string} providerId - Значение идентификатора
   * @param {boolean} verified - Флаг верификации идентификатора (не используется в БД)
   * @returns {Promise<object>} - Результат операции
   */
  async saveIdentity(userId, provider, providerId, verified = true) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(
          `[IdentityService] Missing required parameters: userId=${userId}, provider=${provider}, providerId=${providerId}`
        );
        return {
          success: false,
          error: 'Missing required parameters',
        };
      }

      // Нормализуем значения
      const { provider: normalizedProvider, providerId: normalizedProviderId } =
        this.normalizeIdentity(provider, providerId);

      // Проверяем тип провайдера и перенаправляем гостевые идентификаторы в unified_guest_mapping
      if (normalizedProvider === 'guest') {
        logger.info(
          `[IdentityService] Converting guest identity for user ${userId} to unified_guest_mapping: ${normalizedProviderId}`
        );

        try {
          const db = require('../db');
          const encryptionUtils = require('../utils/encryptionUtils');
          const encryptionKey = encryptionUtils.getEncryptionKey();
          
          await db.getQuery()(
            `INSERT INTO unified_guest_mapping (user_id, identifier_encrypted, channel, created_at)
             VALUES ($1, encrypt_text($2, $4), $3, NOW())
             ON CONFLICT (identifier_encrypted, channel) DO NOTHING`,
            [userId, `web:${normalizedProviderId}`, 'web', encryptionKey]
          );
          return { success: true };
        } catch (guestError) {
          logger.error(
            `[IdentityService] Error saving guest identity for user ${userId}:`,
            guestError
          );
          return { success: false, error: guestError.message };
        }
      }

      // Проверяем, разрешен ли такой тип провайдера
      const allowedProviders = ['email', 'phone', 'website', 'wallet', 'telegram', 'username'];
      if (!allowedProviders.includes(normalizedProvider)) {
        logger.warn(`[IdentityService] Invalid provider type: ${normalizedProvider}`);
        return {
          success: false,
          error: `Invalid provider type: ${normalizedProvider}`,
        };
      }

      const existingOwnerId = await this.findUserIdByIdentity(
        normalizedProvider,
        normalizedProviderId
      );
      if (existingOwnerId !== null && Number(existingOwnerId) !== Number(userId)) {
        return {
          success: false,
          error: `Идентификатор ${this.getIdentityProviderLabel(normalizedProvider)} уже используется другим контактом`,
        };
      }

      // email/phone: обновляем primary или создаём primary (не затираем доп. строки)
      if (this.isMultiRowProvider(normalizedProvider)) {
        const primary = await this.findPrimaryIdentity(userId, normalizedProvider);
        const encryptionKey = encryptionUtils.getEncryptionKey();
        if (primary) {
          if (primary.provider_id === normalizedProviderId) {
            return { success: true, identity: primary };
          }
          await db.getQuery()(
            `UPDATE user_identities
             SET provider_id_encrypted = encrypt_text($1, $3)
             WHERE id = $2 AND user_id = $4`,
            [normalizedProviderId, primary.id, encryptionKey, userId]
          );
          logger.info(
            `[IdentityService] Updated primary ${normalizedProvider} for user ${userId}`
          );
          return {
            success: true,
            identity: { ...primary, provider_id: normalizedProviderId, value: normalizedProviderId }
          };
        }
        const added = await this.addContactIdentity(userId, normalizedProvider, normalizedProviderId, {
          makePrimary: true,
          label: ''
        });
        return added;
      }

      // telegram / wallet / username — одна строка на провайдера
      const existingIdentity = await this.findIdentity(userId, normalizedProvider);
      if (existingIdentity) {
        await encryptedDb.saveData('user_identities', {
          provider: normalizedProvider,
          provider_id: normalizedProviderId
        }, {
          user_id: userId,
          provider: normalizedProvider
        });

          logger.info(
          `[IdentityService] Updated identity for user ${userId}: ${normalizedProvider}=${normalizedProviderId}`
          );
      } else {
        await encryptedDb.saveData('user_identities', {
          user_id: userId,
          provider: normalizedProvider,
          provider_id: normalizedProviderId,
          is_primary: true
        });

        logger.info(
          `[IdentityService] Saved new identity for user ${userId}: ${normalizedProvider}=${normalizedProviderId}`
        );
      }

      return { success: true };
    } catch (error) {
      logger.error(
        `[IdentityService] Error saving identity for user ${userId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Получает все идентификаторы пользователя
   * @param {number} userId - ID пользователя
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentities(userId) {
    try {
      return await this.listIdentitiesRaw(userId);
    } catch (error) {
      logger.error(`[IdentityService] Error getting identities for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Получает идентификаторы пользователя по типу провайдера
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип провайдера
   * @returns {Promise<Array>} - Массив идентификаторов
   */
  async getUserIdentitiesByProvider(userId, provider) {
    try {
      const identities = await encryptedDb.getData('user_identities', { 
        user_id: userId, 
        provider: provider.toLowerCase() 
      });
      return identities;
    } catch (error) {
      logger.error(`[IdentityService] Error getting identities by provider for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Находит user_id по идентификатору (прямой SQL — надёжнее для зашифрованных полей)
   */
  async findUserIdByIdentity(provider, providerId) {
    try {
      const normalizedProvider = provider?.toLowerCase();
      if (!normalizedProvider) {
        return null;
      }

      const variants = this.getIdentityLookupVariants(normalizedProvider, providerId);
      if (!variants.length) {
        return null;
      }

      const encryptionKey = encryptionUtils.getEncryptionKey();

      for (const variant of variants) {
        const result = await db.getQuery()(
          `SELECT user_id FROM user_identities
           WHERE provider_encrypted = encrypt_text($1, $3)
             AND provider_id_encrypted = encrypt_text($2, $3)
           LIMIT 1`,
          [normalizedProvider, variant, encryptionKey]
        );

        if (result.rows.length > 0) {
          return result.rows[0].user_id;
        }
      }

      return null;
    } catch (error) {
      logger.error('[IdentityService] Error finding user id by identity:', error);
      throw error;
    }
  }

  /**
   * Проверяет, свободен ли идентификатор (или принадлежит excludeUserId)
   */
  async assertIdentityAvailable(provider, providerId, excludeUserId = null) {
    let ownerId;
    try {
      ownerId = await this.findUserIdByIdentity(provider, providerId);
    } catch (error) {
      logger.error('[IdentityService] Duplicate check failed:', error);
      return {
        available: false,
        error: 'Не удалось проверить уникальность идентификатора',
      };
    }

    if (ownerId === null) {
      return { available: true };
    }
    if (excludeUserId !== null && Number(ownerId) === Number(excludeUserId)) {
      return { available: true };
    }
    const normalizedProvider = provider?.toLowerCase();
    return {
      available: false,
      provider: normalizedProvider,
      userId: ownerId,
      error: `Идентификатор ${this.getIdentityProviderLabel(normalizedProvider)} уже используется другим контактом`,
    };
  }

  /**
   * Обновляет email / telegram / wallet контакта с проверкой уникальности
   */
  async updateContactIdentities(userId, updates = {}) {
    const payload = await this.buildContactIdentityPayload(userId);
    const current = {
      email: payload.email,
      phone: payload.phone,
      website: payload.website,
      telegram: payload.telegram,
      wallet: payload.wallet
    };

    const next = {
      email: updates.email !== undefined
        ? this.normalizeContactIdentityValue('email', updates.email)
        : (current.email || null),
      phone: updates.phone !== undefined
        ? this.normalizeContactIdentityValue('phone', updates.phone)
        : (current.phone || null),
      website: updates.website !== undefined
        ? this.normalizeContactIdentityValue('website', updates.website)
        : (current.website || null),
      telegram: updates.telegram !== undefined
        ? this.normalizeContactIdentityValue('telegram', updates.telegram)
        : (current.telegram || null),
      wallet: updates.wallet !== undefined
        ? this.normalizeContactIdentityValue('wallet', updates.wallet)
        : (current.wallet || null),
    };

    if (!next.email && !next.phone && !next.website && !next.telegram && !next.wallet) {
      return {
        success: false,
        error: 'Укажите хотя бы один идентификатор: email, телефон, сайт, telegram или кошелёк',
      };
    }

    for (const provider of CONTACT_IDENTITY_PROVIDERS) {
      const newValue = next[provider];
      const oldValue = current[provider] || null;
      const normalizedOld = oldValue
        ? this.normalizeContactIdentityValue(provider, oldValue)
        : null;

      if (newValue === normalizedOld) {
        continue;
      }

      if (newValue) {
        const validation = this.validateContactIdentityValue(provider, newValue);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }

        const availability = await this.assertIdentityAvailable(provider, validation.value, userId);
        if (!availability.available) {
          return { success: false, error: availability.error };
        }
        const saveResult = await this.saveIdentity(userId, provider, validation.value, true);
        if (!saveResult.success) {
          return saveResult;
        }
      } else if (oldValue) {
        if (this.isMultiRowProvider(provider)) {
          // Legacy PATCH clear: удаляем только primary, доп. строки оставляем
          const primary = await this.findPrimaryIdentity(userId, provider);
          if (primary) {
            const deleteResult = await this.deleteContactIdentityRow(userId, primary.id);
            if (!deleteResult.success) return deleteResult;
          }
        } else {
          const deleteResult = await this.deleteIdentity(userId, provider, oldValue);
          if (!deleteResult.success) {
            return deleteResult;
          }
        }
      }
    }

    return { success: true };
  }

  /**
   * Находит пользователя по идентификатору
   * @param {string} provider - Тип провайдера
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<object|null>} - Пользователь или null
   */
  async findUserByIdentity(provider, providerId) {
    try {
      const userId = await this.findUserIdByIdentity(provider, providerId);
      if (userId === null) {
        return null;
      }

      const users = await encryptedDb.getData('users', { id: userId }, 1);
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error(`[IdentityService] Error finding user by identity:`, error);
      return null;
    }
  }

  /**
   * Находит конкретный идентификатор пользователя
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип провайдера
   * @returns {Promise<object|null>} - Идентификатор или null
   */
  async findIdentity(userId, provider) {
    try {
      const normalized = String(provider || '').toLowerCase();
      if (this.isMultiRowProvider(normalized)) {
        return await this.findPrimaryIdentity(userId, normalized);
      }
      const list = await this.listIdentitiesRaw(userId, normalized);
      return list[0] || null;
    } catch (error) {
      logger.error(`[IdentityService] Error finding identity for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Сохраняет идентификаторы из сессии для пользователя
   * @param {object} session - Объект сессии
   * @param {number} userId - ID пользователя
   * @returns {Promise<object>} - Результат операции
   */
  async saveIdentitiesFromSession(session, userId) {
    try {
      if (!session || !userId) {
        logger.warn(`[IdentityService] Missing parameters: session=${!!session}, userId=${userId}`);
        return { success: false, error: 'Missing required parameters' };
      }

      const results = [];

      // Сохраняем все постоянные идентификаторы из сессии
      if (session.email) {
        const emailResult = await this.saveIdentity(userId, 'email', session.email, true);
        results.push({ type: 'email', result: emailResult });
      }

      if (session.address) {
        const walletResult = await this.saveIdentity(userId, 'wallet', session.address, true);
        results.push({ type: 'wallet', result: walletResult });
      }

      if (session.telegramId) {
        const telegramResult = await this.saveIdentity(
          userId,
          'telegram',
          session.telegramId,
          true
        );
        results.push({ type: 'telegram', result: telegramResult });
      }

      // Сохраняем гостевые идентификаторы в unified_guest_mapping
      if (session.guestId) {
        try {
          const db = require('../db');
          const encryptionUtils = require('../utils/encryptionUtils');
          const encryptionKey = encryptionUtils.getEncryptionKey();
          
          await db.getQuery()(
            `INSERT INTO unified_guest_mapping (user_id, identifier_encrypted, channel, created_at)
             VALUES ($1, encrypt_text($2, $4), $3, NOW())
             ON CONFLICT (identifier_encrypted, channel) DO NOTHING`,
            [userId, `web:${session.guestId}`, 'web', encryptionKey]
          );
          results.push({ type: 'guest', result: { success: true } });
        } catch (error) {
          logger.error(`[IdentityService] Error saving guest ID for user ${userId}:`, error);
          results.push({ type: 'guest', result: { success: false, error: error.message } });
        }
      }

      if (session.previousGuestId && session.previousGuestId !== session.guestId) {
        try {
          const db = require('../db');
          const encryptionUtils = require('../utils/encryptionUtils');
          const encryptionKey = encryptionUtils.getEncryptionKey();
          
          await db.getQuery()(
            `INSERT INTO unified_guest_mapping (user_id, identifier_encrypted, channel, created_at)
             VALUES ($1, encrypt_text($2, $4), $3, NOW())
             ON CONFLICT (identifier_encrypted, channel) DO NOTHING`,
            [userId, `web:${session.previousGuestId}`, 'web', encryptionKey]
          );
          results.push({ type: 'previousGuest', result: { success: true } });
        } catch (error) {
          logger.error(
            `[IdentityService] Error saving previous guest ID for user ${userId}:`,
            error
          );
          results.push({ type: 'previousGuest', result: { success: false, error: error.message } });
        }
      }

      logger.info(
        `[IdentityService] Saved ${results.length} identities from session for user ${userId}`
      );
      return { success: true, results };
    } catch (error) {
      logger.error(
        `[IdentityService] Error saving identities from session for user ${userId}:`,
        error
      );
      return { success: false, error: error.message };
    }
  }

  /**
   * Мигрирует все идентификаторы и сообщения от одного пользователя к другому
   * @param {number} fromUserId - ID исходного пользователя
   * @param {number} toUserId - ID целевого пользователя
   * @returns {Promise<object>} - Результат операции
   */
  async migrateUserData(fromUserId, toUserId) {
    try {
      if (!fromUserId || !toUserId) {
        logger.warn(
          `[IdentityService] Missing parameters: fromUserId=${fromUserId}, toUserId=${toUserId}`
        );
        return { success: false, error: 'Missing required parameters' };
      }

        // Получаем все идентификаторы исходного пользователя
      const identities = await encryptedDb.getData('user_identities', { user_id: fromUserId });

        // Переносим каждый идентификатор
      for (const identity of identities) {
        // Создаем новый идентификатор для целевого пользователя
        await encryptedDb.saveData('user_identities', {
          user_id: toUserId,
          provider: identity.provider,
          provider_id: identity.provider_id
        });

          // Удаляем старый идентификатор
        await encryptedDb.deleteData('user_identities', {
          user_id: fromUserId,
          provider: identity.provider,
          provider_id: identity.provider_id
        });
        }

      // Мигрируем гостевые идентификаторы
      const guestMappings = await encryptedDb.getData('unified_guest_mapping', { user_id: fromUserId });

        // Переносим каждый гостевой идентификатор
      for (const mapping of guestMappings) {
        const db = require('../db');
        const encryptionUtils = require('../utils/encryptionUtils');
        const encryptionKey = encryptionUtils.getEncryptionKey();
        
        await db.getQuery()(
          `INSERT INTO unified_guest_mapping (user_id, identifier_encrypted, channel, processed, processed_at, created_at)
           VALUES ($1, encrypt_text($2, $6), $3, $4, $5, NOW())
           ON CONFLICT (identifier_encrypted, channel) DO UPDATE SET user_id = $1, processed = $4, processed_at = $5`,
          [toUserId, mapping.identifier_encrypted, mapping.channel, mapping.processed, mapping.processed_at, encryptionKey]
        );
        }

        // Удаляем старые гостевые маппинги
      await encryptedDb.deleteData('unified_guest_mapping', { user_id: fromUserId });

        // Переносим все сообщения
      const messages = await encryptedDb.getData('messages', { user_id: fromUserId });
      for (const message of messages) {
        await encryptedDb.saveData('messages', {
          ...message,
          user_id: toUserId
        });
        await encryptedDb.deleteData('messages', { id: message.id });
      }

        // Переносим все диалоги
      const conversations = await encryptedDb.getData('conversations', { user_id: fromUserId });
      for (const conversation of conversations) {
        await encryptedDb.saveData('conversations', {
          ...conversation,
          user_id: toUserId
        });
        await encryptedDb.deleteData('conversations', { id: conversation.id });
      }

        // Переносим настройки пользователя
      const preferences = await encryptedDb.getData('user_preferences', { user_id: fromUserId });
      for (const preference of preferences) {
        await encryptedDb.saveData('user_preferences', {
          ...preference,
          user_id: toUserId
        });
        await encryptedDb.deleteData('user_preferences', { id: preference.id });
      }

        logger.info(
          `[IdentityService] Successfully migrated data from user ${fromUserId} to ${toUserId}`
        );
        return { success: true };
    } catch (error) {
      logger.error(`[IdentityService] Error migrating user data:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Находит всех пользователей с похожими идентификаторами
   * @param {object} identities - Объект с идентификаторами
   * @returns {Promise<Array>} - Массив ID пользователей
   */
  async findRelatedUsers(identities) {
    try {
      const userIds = new Set();

      for (const [provider, providerId] of Object.entries(identities)) {
        if (!providerId) continue;

        const users = await encryptedDb.getData('user_identities', {
          provider: provider,
          provider_id: providerId
        });

        users.forEach((user) => userIds.add(user.user_id));
      }

      return Array.from(userIds);
    } catch (error) {
      logger.error(`[IdentityService] Error finding related users:`, error);
      return [];
    }
  }

  /**
   * Удаляет идентификатор пользователя
   * @param {number} userId - ID пользователя
   * @param {string} provider - Тип идентификатора
   * @param {string} providerId - Значение идентификатора
   * @returns {Promise<object>} - Результат операции
   */
  async deleteIdentity(userId, provider, providerId) {
    try {
      if (!userId || !provider || !providerId) {
        logger.warn(`[IdentityService] Missing parameters for deleteIdentity: userId=${userId}, provider=${provider}, providerId=${providerId}`);
        return { success: false, error: 'Missing required parameters' };
      }
      const { provider: normalizedProvider, providerId: normalizedProviderId } = this.normalizeIdentity(provider, providerId);
      const result = await encryptedDb.deleteData('user_identities', {
        user_id: userId,
        provider: normalizedProvider,
        provider_id: normalizedProviderId
      });
      logger.info(`[IdentityService] Deleted identity ${normalizedProvider}:${normalizedProviderId} for user ${userId}`);
      return { success: true, deleted: result.length };
    } catch (error) {
      logger.error(`[IdentityService] Error deleting identity ${provider}:${providerId} for user ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Универсальная функция: найти или создать пользователя по идентификатору, привязать идентификатор, проверить роль
   * @param {string} provider - Тип идентификатора ('email' | 'telegram')
   * @param {string} providerId - Значение идентификатора
   * @param {object} [options] - Дополнительные опции
   * @returns {Promise<{userId: number, role: string, isNew: boolean}>}
   */
  async findOrCreateUserWithRole(provider, providerId, options = {}) {
    let user = await this.findUserByIdentity(provider, providerId);
    let isNew = false;
    if (!user) {
      // Создаем пользователя с централизованной ролью
      const { ROLES } = require('/app/shared/permissions');
      const newUser = await encryptedDb.saveData('users', {
        role: ROLES.USER
      });
      const userId = newUser.id;
      await this.saveIdentity(userId, provider, providerId, true);
      user = { id: userId, role: ROLES.USER };
      isNew = true;
      logger.info('[WS] broadcastContactsUpdate after new user created');
      broadcastContactsUpdate();
    }
    // Проверяем связь с кошельком
    const wallet = await getLinkedWallet(user.id);
    const { ROLES } = require('/app/shared/permissions');
    let role = ROLES.USER;
    if (wallet) {
      const userAccessLevel = await authService.getUserAccessLevel(wallet);
      // Используем роль из userAccessLevel, которая уже правильно определена с учетом порогов
      role = userAccessLevel.level;
      // Обновляем роль в users, если изменилась
      if (user.role !== role) {
        await encryptedDb.saveData('users', {
          role: role
        }, {
          id: user.id
        });
      }
    }
    return { userId: user.id, role, isNew };
  }
}

module.exports = new IdentityService();
