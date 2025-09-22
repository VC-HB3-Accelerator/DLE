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

/**
 * Lightweight encrypted secret store over encryptedDatabaseService
 */
const crypto = require('crypto');
const encryptedDb = require('./encryptedDatabaseService');

const TABLE = 'secrets';

async function getSecret(key) {
  const rows = await encryptedDb.getData(TABLE, { key }, 1);
  return rows && rows[0] ? rows[0].value : null;
}

async function setSecret(key, value) {
  const existing = await encryptedDb.getData(TABLE, { key }, 1);
  const payload = { key, value, updated_at: new Date() };
  if (existing && existing.length) {
    await encryptedDb.saveData(TABLE, payload, { key });
  } else {
    payload.created_at = new Date();
    await encryptedDb.saveData(TABLE, payload);
  }
  return value;
}

async function getOrCreateCreate2Salt() {
  let salt = await getSecret('CREATE2_SALT');
  if (salt && /^0x[0-9a-fA-F]{64}$/.test(salt)) return salt;
  const hex = crypto.randomBytes(32).toString('hex');
  salt = '0x' + hex;
  await setSecret('CREATE2_SALT', salt);
  return salt;
}

/**
 * Генерирует одноразовый CREATE2 salt (0x + 32 байта) и сохраняет в secrets с уникальным ключом
 * @param {Object} [opts]
 * @param {string} [opts.prefix] Префикс ключа (по умолчанию CREATE2_SALT)
 * @param {string} [opts.label] Доп. метка (например, имя DLE)
 * @returns {Promise<{ salt: string, key: string }>}
 */
async function createAndStoreNewCreate2Salt(opts = {}) {
  const prefix = opts.prefix || 'CREATE2_SALT';
  const label = (opts.label || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 40);
  const hex = crypto.randomBytes(32).toString('hex');
  const salt = '0x' + hex;
  const rand = crypto.randomBytes(2).toString('hex');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const key = [prefix, label, ts, rand].filter(Boolean).join(':');
  await setSecret(key, salt);
  return { salt, key };
}

module.exports = { getSecret, setSecret, getOrCreateCreate2Salt, createAndStoreNewCreate2Salt };


