/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const logger = require('../utils/logger');
const { getSecret, setSecret } = require('./secretStore');

const FOOTER_DLE_KEY = 'FOOTER_DLE_SELECTION';

function parseSelection(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === 'object') {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      logger.warn('[FooterDleService] Не удалось распарсить сохраненное значение footer DLE:', error.message);
    }
  }

  return null;
}

async function getFooterSelection() {
  const storedValue = await getSecret(FOOTER_DLE_KEY);
  const parsed = parseSelection(storedValue);

  if (!parsed) {
    return null;
  }

  return {
    address: parsed.address || null,
    chainId: parsed.chainId ?? null,
    updatedAt: parsed.updatedAt || null,
    updatedBy: parsed.updatedBy || null,
  };
}

async function setFooterSelection({ address, chainId = null, updatedBy = null }) {
  const payload = {
    address,
    chainId: chainId !== undefined && chainId !== null ? Number(chainId) : null,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || null,
  };

  await setSecret(FOOTER_DLE_KEY, JSON.stringify(payload));
  return payload;
}

async function clearFooterSelection(updatedBy = null) {
  const payload = {
    address: null,
    chainId: null,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || null,
  };

  await setSecret(FOOTER_DLE_KEY, JSON.stringify(payload));
  return payload;
}

module.exports = {
  getFooterSelection,
  setFooterSelection,
  clearFooterSelection,
};

