/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/roleScreenAllowlist.js для Vite.
 */

import {
  normalizePath,
  roleKeyForScreens,
  isScreenAllowedByMap,
  cloneDefaultScreens
} from './roleScreenCaps.js';

export { normalizePath, roleKeyForScreens };

/**
 * @param {string} role
 * @param {string} path
 * @param {Record<string, boolean>|null} [screensMap]
 */
export function isScreenAllowed(role, path, screensMap) {
  const map = screensMap && typeof screensMap === 'object'
    ? screensMap
    : cloneDefaultScreens(roleKeyForScreens(role));
  return isScreenAllowedByMap(map, path);
}
