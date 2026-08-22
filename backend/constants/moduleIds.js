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

/**
 * Стандартные ID модулей DLE
 * Эти ID используются для идентификации модулей в смарт-контракте DLE
 * 
 * Формат: ASCII-коды названий модулей, дополненные нулями до 32 байт
 * Это не стандартные keccak256 хеши, а просто padded ASCII строки
 */
const MODULE_IDS = {
  // Treasury Module - модуль для управления казной
  TREASURY: '0x7472656173757279000000000000000000000000000000000000000000000000',
  
  // Timelock Module - модуль для задержки выполнения операций
  TIMELOCK: '0x74696d656c6f636b000000000000000000000000000000000000000000000000',
  
  // Reader Module - модуль для чтения данных DLE
  READER: '0x7265616465720000000000000000000000000000000000000000000000000000',

  // Hierarchical Voting — ASCII "hierarchicalVoting" (19 байт) + zero-pad
  // keccak256 не используем: в ядре исторически padded ASCII
  HIERARCHICAL_VOTING: '0x68696572617263686963616c566f74696e670000000000000000000000000000'
};

/**
 * Маппинг типов модулей на их ID
 * Используется для удобства работы с модулями в API
 */
const MODULE_TYPE_TO_ID = {
  treasury: MODULE_IDS.TREASURY,
  timelock: MODULE_IDS.TIMELOCK,
  reader: MODULE_IDS.READER,
  hierarchicalVoting: MODULE_IDS.HIERARCHICAL_VOTING
};

/** Ошибочные padded-ASCII ID, которыми UI когда-то звал createAddModuleProposal */
const LEGACY_MODULE_IDS = {
  treasury: [
    '0x7472656173757279206d6f64756c650000000000000000000000000000000000', // "treasury module"
    '0x5472656173757279204d6f64756c650000000000000000000000000000000000', // "Treasury Module"
  ],
  hierarchicalVoting: [
    '0x68696572617263686963616c2d766f74696e6700000000000000000000000000', // "hierarchical-voting"
  ],
};

function candidateModuleIds(moduleType) {
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

function moduleTypeFromId(moduleId) {
  if (moduleId == null) return null;
  const key = String(moduleId).toLowerCase();
  for (const [id, type] of Object.entries(MODULE_ID_TO_TYPE)) {
    if (String(id).toLowerCase() === key) return type;
  }
  return null;
}

/**
 * Маппинг ID модулей на их типы
 * Обратный маппинг для удобства
 */
const MODULE_ID_TO_TYPE = {
  [MODULE_IDS.TREASURY]: 'treasury',
  [MODULE_IDS.TIMELOCK]: 'timelock',
  [MODULE_IDS.READER]: 'reader',
  [MODULE_IDS.HIERARCHICAL_VOTING]: 'hierarchicalVoting',
  '0x7472656173757279206d6f64756c650000000000000000000000000000000000': 'treasury',
  '0x5472656173757279204d6f64756c650000000000000000000000000000000000': 'treasury',
  '0x68696572617263686963616c2d766f74696e6700000000000000000000000000': 'hierarchicalVoting',
};

/**
 * Названия модулей для отображения
 */
const MODULE_NAMES = {
  treasury: 'Treasury Module',
  timelock: 'Timelock Module',
  reader: 'Reader Module',
  hierarchicalVoting: 'Hierarchical Voting Module'
};

/**
 * Описания модулей
 */
const MODULE_DESCRIPTIONS = {
  treasury: 'Модуль для управления казной и финансоческими операциями DLE',
  timelock: 'Модуль для задержки выполнения критических операций',
  reader: 'Модуль для чтения и получения данных о состоянии DLE',
  hierarchicalVoting: 'Модуль иерархического голосования (головной DLE → дочерние)'
};

module.exports = {
  MODULE_IDS,
  MODULE_TYPE_TO_ID,
  MODULE_ID_TO_TYPE,
  MODULE_NAMES,
  MODULE_DESCRIPTIONS,
  LEGACY_MODULE_IDS,
  candidateModuleIds,
  moduleTypeFromId,
};
