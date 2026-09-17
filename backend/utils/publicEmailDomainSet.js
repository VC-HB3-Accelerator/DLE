/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Полный набор публичных/free-mail доменов для gate регистрации:
 * известные consumer-почты + расширенный JSON (в т.ч. одноразовые ящики).
 */

const logger = require('./logger');

function loadSharedPublic() {
  try {
    return require('/app/shared/publicEmailDomains');
  } catch {
    return require('../../shared/publicEmailDomains');
  }
}

function loadExtraJson() {
  try {
    return require('/app/shared/data/publicEmailDomains.json');
  } catch {
    try {
      return require('../../shared/data/publicEmailDomains.json');
    } catch {
      return [];
    }
  }
}

const sharedPublic = loadSharedPublic();
const {
  normalizeDomain,
  isPublicEmailDomain: isNotableOrFamilyPublicDomain,
  listNotablePublicEmailDomains,
} = sharedPublic;

let fullSet = null;

function getBlockedPublicEmailDomainSet() {
  if (fullSet) return fullSet;
  fullSet = new Set(listNotablePublicEmailDomains());
  const extra = loadExtraJson();
  if (Array.isArray(extra)) {
    for (const item of extra) {
      const domain = normalizeDomain(item);
      if (domain) fullSet.add(domain);
    }
  }
  logger.info(`[publicEmailDomains] loaded ${fullSet.size} blocked public domains`);
  return fullSet;
}

function isBlockedPublicEmailDomain(domain) {
  const d = normalizeDomain(domain);
  if (!d) return false;
  if (isNotableOrFamilyPublicDomain(d)) return true;
  return getBlockedPublicEmailDomainSet().has(d);
}

module.exports = {
  normalizeDomain,
  isNotableOrFamilyPublicDomain,
  isBlockedPublicEmailDomain,
  listNotablePublicEmailDomains,
  getBlockedPublicEmailDomainSet,
};
