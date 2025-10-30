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
  READER: '0x7265616465720000000000000000000000000000000000000000000000000000'
};

/**
 * Маппинг типов модулей на их ID
 * Используется для удобства работы с модулями в API
 */
const MODULE_TYPE_TO_ID = {
  treasury: MODULE_IDS.TREASURY,
  timelock: MODULE_IDS.TIMELOCK,
  reader: MODULE_IDS.READER
};

/**
 * Маппинг ID модулей на их типы
 * Обратный маппинг для удобства
 */
const MODULE_ID_TO_TYPE = {
  [MODULE_IDS.TREASURY]: 'treasury',
  [MODULE_IDS.TIMELOCK]: 'timelock',
  [MODULE_IDS.READER]: 'reader'
};

/**
 * Названия модулей для отображения
 */
const MODULE_NAMES = {
  treasury: 'Treasury Module',
  timelock: 'Timelock Module',
  reader: 'Reader Module'
};

/**
 * Описания модулей
 */
const MODULE_DESCRIPTIONS = {
  treasury: 'Модуль для управления казной и финансовыми операциями DLE',
  timelock: 'Модуль для задержки выполнения критических операций',
  reader: 'Модуль для чтения и получения данных о состоянии DLE'
};

module.exports = {
  MODULE_IDS,
  MODULE_TYPE_TO_ID,
  MODULE_ID_TO_TYPE,
  MODULE_NAMES,
  MODULE_DESCRIPTIONS
};
