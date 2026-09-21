/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Матрица видимости экранов/блоков по ролям ОС.
 * guest — без входа; user — вошёл, токенов нет; readonly/editor — по токенам.
 * Не заменяет PERMISSIONS_MAP.
 */

const SCREEN_ROLES = Object.freeze(["guest", "user", "readonly", "editor"]);

/** Редактор не может закрыть себе страницу матрицы — иначе lock-out. */
const EDITOR_LOCKED_SCREENS = Object.freeze(["/settings/security/roles"]);

/**
 * Все управляемые экраны/блоки (path-префиксы / паттерны с :param).
 * Группы — только для UI на /settings/security/roles.
 */
const SCREEN_GROUPS = Object.freeze([
  {
    id: "nav",
    keys: Object.freeze([
      "/",
      "/blog",
      "/blog/feed-settings",
      "/blog/my-subscriptions",
      "/management",
      "/store",
    ]),
  },
  {
    id: "management",
    keys: Object.freeze([
      "/management/dle",
      "/management/dle-blocks",
      "/management/create-proposal",
      "/management/proposals",
      "/management/modules",
      "/management/analytics",
      "/management/history",
      "/management/settings",
      "/management/add-module",
      "/management/remove-module",
      "/management/transfer-tokens",
      "/management/module-bridge-op",
      "/management/treasury-bridge-op",
      "/management/dle-core-op",
    ]),
  },
  {
    id: "crm_hub",
    keys: Object.freeze([
      "/contacts-list",
      "/content",
      "/vds",
      "/tables",
      "/groups",
      "/crm/store",
    ]),
  },
  {
    id: "contacts",
    keys: Object.freeze([
      "/contacts-list/parser",
      "/contacts-list/broadcast",
      "/contacts-list/broadcast/agent",
      "/contacts-list/broadcast/analytics",
      "/contacts-list/broadcast/history",
      "/contacts/:id",
      "/contacts/:id/profile",
      "/contacts/:id/orders",
      "/contacts/:id/cart",
      "/contacts/:id/conference",
      "/contacts/:id/conference/create",
      "/contacts/:id/conference/agent",
      "/contacts/:id/conference/live/:sessionId",
      "/contacts/:id/delete",
      "/conferences",
      "/conferences/schedule",
      "/conferences/:sessionId",
      "/conferences/:sessionId/agent",
      "/conferences/:sessionId/live",
      "/admin-chat/:adminId",
      "/personal-messages",
      "/personal-calls",
      "/contacts-list/calls/calendar",
      "/book-call",
      "/conference/join",
      "/conference/live/:sessionId",
    ]),
  },
  {
    id: "content",
    keys: Object.freeze([
      "/content/create",
      "/content/moderation",
      "/content/published",
      "/content/published/:slug",
      "/content/internal",
      "/content/templates",
      "/content/settings",
      "/content/system-messages/table",
      "/content/media",
      "/content/store",
      "/content/store/settings",
      "/content/store/sections",
      "/content/store/sections/new",
      "/content/store/sections/:id",
      "/content/store/product/new",
      "/content/store/product/:id",
      "/content/page/:id",
      "/public/page/:id",
    ]),
  },
  {
    id: "tables",
    keys: Object.freeze([
      "/tables/create",
      "/tables/:id",
      "/tables/:id/edit",
      "/tables/:id/delete",
    ]),
  },
  {
    id: "settings_hub",
    keys: Object.freeze([
      "/settings/ai",
      "/settings/security",
      "/settings/sidebar",
      "/settings/updates",
    ]),
  },
  {
    id: "settings_security",
    keys: Object.freeze([
      "/settings/security/rpc",
      "/settings/dle-v2-deploy",
      "/settings/security/auth",
      "/settings/security/database",
      "/settings/security/roles",
    ]),
  },
  {
    id: "settings_sidebar",
    keys: Object.freeze([
      "/settings/sidebar/text",
      "/settings/sidebar/languages",
      "/settings/sidebar/auth",
      "/settings/sidebar/buttons",
      "/settings/sidebar/regions",
    ]),
  },
  {
    id: "settings_ai",
    keys: Object.freeze([
      "/settings/ai/openai",
      "/settings/ai/deepseek",
      "/settings/ai/qwencloud",
      "/settings/ai/translation",
      "/settings/ai/vpn",
      "/settings/ai/ollama",
      "/settings/ai/telegram",
      "/settings/ai/email",
      "/settings/ai/rag",
      "/settings/ai/agent-access",
      "/settings/ai/voice-call",
      "/settings/ai/assistant",
    ]),
  },
  {
    id: "settings_server",
    keys: Object.freeze(["/settings/interface/webssh"]),
  },
  {
    id: "store",
    keys: Object.freeze([
      "/store/cart",
      "/store/pay/:id",
      "/store/s/:slug",
      "/store/:id",
    ]),
  },
  {
    id: "other",
    keys: Object.freeze(["/blog/:slug", "/connect-wallet"]),
  },
]);

const SCREEN_KEYS = Object.freeze(SCREEN_GROUPS.flatMap((g) => g.keys));

function normalizePath(path) {
  const raw = String(path || "")
    .split("?")[0]
    .split("#")[0];
  if (!raw) return "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withSlash.length > 1 && withSlash.endsWith("/"))
    return withSlash.slice(0, -1);
  return withSlash;
}

function roleKeyForScreens(role) {
  const r = String(role || "")
    .trim()
    .toLowerCase();
  if (r === "user") return "user";
  if (r === "readonly") return "readonly";
  if (r === "editor") return "editor";
  return "guest";
}

function pathMatchesKey(path, key) {
  const pParts = normalizePath(path).split("/");
  const kParts = String(key).split("/");
  if (kParts.length > pParts.length) return false;
  for (let i = 0; i < kParts.length; i += 1) {
    const kp = kParts[i];
    const pp = pParts[i];
    if (kp.startsWith(":")) {
      if (!pp) return false;
      continue;
    }
    if (kp !== pp) return false;
  }
  return true;
}

function resolveScreenKey(path) {
  const p = normalizePath(path);
  let best = null;
  let bestLen = -1;
  for (const key of SCREEN_KEYS) {
    if (!pathMatchesKey(p, key)) continue;
    const len = String(key).split("/").length;
    if (len > bestLen) {
      best = key;
      bestLen = len;
    }
  }
  return best;
}

/** Дефолты гостя ≈ прежний hardcoded allowlist (ТЗ P2). */
function defaultGuestScreens() {
  const out = {};
  for (const key of SCREEN_KEYS) out[key] = false;

  const allowExactOrUnder = [
    "/",
    "/blog",
    "/blog/:slug",
    "/book-call",
    "/conference/join",
    "/connect-wallet",
    "/public/page/:id",
    "/content/published",
    "/content/published/:slug",
    "/store",
    "/store/cart",
    "/store/pay/:id",
    "/store/s/:slug",
    "/store/:id",
    "/management",
    "/management/dle",
    "/management/dle-blocks",
    "/management/create-proposal",
    "/management/proposals",
    "/management/modules",
    "/management/analytics",
    "/management/history",
    "/management/settings",
    "/management/add-module",
    "/management/remove-module",
    "/management/transfer-tokens",
    "/management/module-bridge-op",
    "/management/treasury-bridge-op",
    "/management/dle-core-op",
    "/settings/security",
    "/settings/ai",
    "/content",
  ];
  for (const key of allowExactOrUnder) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = true;
  }
  return out;
}

function defaultFullAccessScreens() {
  const out = {};
  for (const key of SCREEN_KEYS) out[key] = true;
  return out;
}

/** Юзер = гость + CRM own + приват + свой контент / таблицы. */
function defaultUserScreens() {
  const out = defaultGuestScreens();
  const extra = [
    "/contacts-list",
    "/contacts/:id",
    "/contacts/:id/profile",
    "/contacts/:id/orders",
    "/contacts/:id/cart",
    "/contacts/:id/conference",
    "/contacts/:id/conference/live/:sessionId",
    "/personal-messages",
    "/personal-calls",
    "/admin-chat/:adminId",
    "/contacts-list/calls/calendar",
    "/contacts-list/broadcast",
    "/contacts-list/broadcast/agent",
    "/contacts-list/broadcast/analytics",
    "/contacts-list/broadcast/history",
    "/conference/live/:sessionId",
    "/tables",
    "/tables/create",
    "/tables/:id",
    "/tables/:id/edit",
    "/tables/:id/delete",
    "/content/create",
    "/content/store/product/new",
    "/content/store/product/:id",
  ];
  for (const key of extra) {
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = true;
  }
  return out;
}

function cloneDefaultScreens(role) {
  const key = roleKeyForScreens(role);
  if (key === "guest") return defaultGuestScreens();
  if (key === "user") return defaultUserScreens();
  return defaultFullAccessScreens();
}

function normalizeScreensMap(rowScreens, role) {
  const base = cloneDefaultScreens(role);
  if (!rowScreens || typeof rowScreens !== "object") return base;
  const migrated = { ...rowScreens };
  // /settings/ai/database → /settings/security/database
  if (
    Object.prototype.hasOwnProperty.call(migrated, "/settings/ai/database") &&
    !Object.prototype.hasOwnProperty.call(
      migrated,
      "/settings/security/database",
    )
  ) {
    migrated["/settings/security/database"] = migrated["/settings/ai/database"];
  }
  for (const key of SCREEN_KEYS) {
    if (migrated[key] === false) base[key] = false;
    else if (migrated[key] === true) base[key] = true;
  }
  if (roleKeyForScreens(role) === "editor") {
    for (const locked of EDITOR_LOCKED_SCREENS) {
      if (Object.prototype.hasOwnProperty.call(base, locked))
        base[locked] = true;
    }
  }
  return base;
}

function isScreenAllowedByMap(screensMap, path) {
  const key = resolveScreenKey(path);
  if (!key) return true;
  if (!screensMap || typeof screensMap !== "object") return true;
  return screensMap[key] !== false;
}

function validateScreensMatrix(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "INVALID_SCREEN_CAPS" };
  }
  const data = {};
  for (const role of SCREEN_ROLES) {
    const block = body[role];
    if (!block || typeof block !== "object") {
      return { ok: false, error: "INVALID_SCREEN_CAPS" };
    }
    const normalized = {};
    for (const key of SCREEN_KEYS) {
      if (typeof block[key] !== "boolean") {
        return { ok: false, error: "INVALID_SCREEN_CAPS" };
      }
      normalized[key] = block[key];
    }
    if (role === "editor") {
      for (const locked of EDITOR_LOCKED_SCREENS) {
        normalized[locked] = true;
      }
    }
    data[role] = normalized;
  }
  return { ok: true, data };
}

function buildDefaultMatrix() {
  return {
    guest: cloneDefaultScreens("guest"),
    user: cloneDefaultScreens("user"),
    readonly: cloneDefaultScreens("readonly"),
    editor: cloneDefaultScreens("editor"),
  };
}

module.exports = {
  SCREEN_ROLES,
  SCREEN_GROUPS,
  SCREEN_KEYS,
  EDITOR_LOCKED_SCREENS,
  normalizePath,
  roleKeyForScreens,
  pathMatchesKey,
  resolveScreenKey,
  cloneDefaultScreens,
  normalizeScreensMap,
  isScreenAllowedByMap,
  validateScreensMatrix,
  buildDefaultMatrix,
};
