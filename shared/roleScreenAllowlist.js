/**
 * Allowlist экранов по роли ОС.
 * Дефолты — roleScreenCaps; runtime-оверлей — матрица из БД (передаётся screensMap).
 */

function loadCaps() {
  try {
    return require('/app/shared/roleScreenCaps');
  } catch (_) {
    return require('./roleScreenCaps');
  }
}

const {
  normalizePath,
  roleKeyForScreens,
  isScreenAllowedByMap,
  cloneDefaultScreens
} = loadCaps();

/**
 * @param {string} role
 * @param {string} path
 * @param {Record<string, boolean>|null} [screensMap] матрица роли из БД; без неё — дефолты
 */
function isScreenAllowed(role, path, screensMap) {
  const map = screensMap && typeof screensMap === 'object'
    ? screensMap
    : cloneDefaultScreens(roleKeyForScreens(role));
  return isScreenAllowedByMap(map, path);
}

module.exports = {
  normalizePath,
  isScreenAllowed,
  roleKeyForScreens
};
