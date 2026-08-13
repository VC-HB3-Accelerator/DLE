/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Реэкспорт лимитов CMS media. Чат не импортирует этот модуль.
 */

function loadLimits() {
  try {
    return require('/app/shared/contentMediaLimits');
  } catch (_) {
    return require('../../shared/contentMediaLimits');
  }
}

module.exports = loadLimits();
