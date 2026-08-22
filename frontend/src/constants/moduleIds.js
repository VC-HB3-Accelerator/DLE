/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Канонические ID модулей в книге DLE: padded ASCII, не keccak256.
 * Должны совпадать с backend/constants/moduleIds.js
 */

export const MODULE_IDS = {
  TREASURY: '0x7472656173757279000000000000000000000000000000000000000000000000',
  TIMELOCK: '0x74696d656c6f636b000000000000000000000000000000000000000000000000',
  READER: '0x7265616465720000000000000000000000000000000000000000000000000000',
  HIERARCHICAL_VOTING: '0x68696572617263686963616c566f74696e670000000000000000000000000000',
};

export const MODULE_TYPE_TO_ID = {
  treasury: MODULE_IDS.TREASURY,
  timelock: MODULE_IDS.TIMELOCK,
  reader: MODULE_IDS.READER,
  hierarchicalVoting: MODULE_IDS.HIERARCHICAL_VOTING,
};

export const LEGACY_MODULE_IDS = {
  treasury: [
    '0x7472656173757279206d6f64756c650000000000000000000000000000000000',
    '0x5472656173757279204d6f64756c650000000000000000000000000000000000',
  ],
  hierarchicalVoting: [
    '0x68696572617263686963616c2d766f74696e6700000000000000000000000000',
  ],
};

export function candidateModuleIds(moduleType) {
  const canonical = MODULE_TYPE_TO_ID[moduleType];
  const extra = LEGACY_MODULE_IDS[moduleType] || [];
  const seen = new Set();
  const out = [];
  for (const id of [canonical, ...extra]) {
    if (!id) continue;
    const key = String(id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

export function getCanonicalModuleId(moduleType) {
  return MODULE_TYPE_TO_ID[moduleType] || null;
}
