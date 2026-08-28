/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Матрица прав на действия по ролям ОС (overlay над PERMISSIONS_MAP).
 * Ключи совпадают с shared/permissions.js → PERMISSIONS.
 */

const PERMISSIONS = Object.freeze({
  VIEW_HOME: 'view_home',
  CHAT_AI: 'chat_ai',
  RECEIVE_MESSAGES: 'receive_messages',
  VIEW_CRM: 'view_crm',
  VIEW_CONTACTS: 'view_contacts',
  VIEW_DATA: 'view_data',
  SEND_TO_USERS: 'send_to_users',
  CHAT_WITH_ADMINS: 'chat_with_admins',
  GENERATE_AI_REPLIES: 'generate_ai_replies',
  EDIT_USER_DATA: 'edit_user_data',
  EDIT_CONTACTS: 'edit_contacts',
  DELETE_USER_DATA: 'delete_user_data',
  DELETE_MESSAGES: 'delete_messages',
  BROADCAST: 'broadcast',
  MANAGE_TAGS: 'manage_tags',
  BLOCK_USERS: 'block_users',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_BASIC_DOCS: 'view_basic_docs',
  VIEW_LEGAL_DOCS: 'view_legal_docs',
  MANAGE_LEGAL_DOCS: 'manage_legal_docs',
  GOVERNANCE_PROPOSAL: 'governance_proposal'
});

const ACTION_ROLES = Object.freeze(['guest', 'user', 'readonly', 'editor']);

const ACTION_KEYS = Object.freeze(Object.values(PERMISSIONS));

/** Редактор не может снять себе управление настройками — иначе lock-out. */
const EDITOR_LOCKED_ACTIONS = Object.freeze([PERMISSIONS.MANAGE_SETTINGS]);

/** Дефолты = PERMISSIONS_MAP из shared/permissions.js */
const DEFAULT_ACTIONS_BY_ROLE = Object.freeze({
  guest: Object.freeze([PERMISSIONS.VIEW_HOME, PERMISSIONS.CHAT_AI]),
  user: Object.freeze([
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI,
    PERMISSIONS.RECEIVE_MESSAGES,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.SEND_TO_USERS,
    PERMISSIONS.CHAT_WITH_ADMINS,
    PERMISSIONS.VIEW_BASIC_DOCS
  ]),
  readonly: Object.freeze([
    PERMISSIONS.VIEW_HOME,
    PERMISSIONS.CHAT_AI,
    PERMISSIONS.RECEIVE_MESSAGES,
    PERMISSIONS.VIEW_CRM,
    PERMISSIONS.VIEW_CONTACTS,
    PERMISSIONS.VIEW_DATA,
    PERMISSIONS.SEND_TO_USERS,
    PERMISSIONS.CHAT_WITH_ADMINS,
    PERMISSIONS.VIEW_BASIC_DOCS,
    PERMISSIONS.VIEW_LEGAL_DOCS,
    PERMISSIONS.GOVERNANCE_PROPOSAL
  ]),
  editor: Object.freeze([...ACTION_KEYS])
});

const ACTION_GROUPS = Object.freeze([
  {
    id: 'public',
    keys: Object.freeze([PERMISSIONS.VIEW_HOME, PERMISSIONS.CHAT_AI, PERMISSIONS.RECEIVE_MESSAGES])
  },
  {
    id: 'view',
    keys: Object.freeze([
      PERMISSIONS.VIEW_CRM,
      PERMISSIONS.VIEW_CONTACTS,
      PERMISSIONS.VIEW_DATA,
      PERMISSIONS.VIEW_BASIC_DOCS,
      PERMISSIONS.VIEW_LEGAL_DOCS
    ])
  },
  {
    id: 'chat',
    keys: Object.freeze([PERMISSIONS.SEND_TO_USERS, PERMISSIONS.CHAT_WITH_ADMINS, PERMISSIONS.GENERATE_AI_REPLIES])
  },
  {
    id: 'edit',
    keys: Object.freeze([
      PERMISSIONS.EDIT_USER_DATA,
      PERMISSIONS.EDIT_CONTACTS,
      PERMISSIONS.DELETE_USER_DATA,
      PERMISSIONS.DELETE_MESSAGES,
      PERMISSIONS.MANAGE_TAGS,
      PERMISSIONS.BLOCK_USERS
    ])
  },
  {
    id: 'ops',
    keys: Object.freeze([
      PERMISSIONS.BROADCAST,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.MANAGE_LEGAL_DOCS,
      PERMISSIONS.GOVERNANCE_PROPOSAL
    ])
  }
]);

function roleKeyForActions(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'user') return 'user';
  if (r === 'readonly') return 'readonly';
  if (r === 'editor') return 'editor';
  return 'guest';
}

function cloneDefaultActions(role) {
  const key = roleKeyForActions(role);
  const list = DEFAULT_ACTIONS_BY_ROLE[key] || DEFAULT_ACTIONS_BY_ROLE.guest;
  const out = {};
  for (const perm of ACTION_KEYS) {
    out[perm] = list.includes(perm);
  }
  if (key === 'editor') {
    for (const locked of EDITOR_LOCKED_ACTIONS) {
      out[locked] = true;
    }
  }
  return out;
}

function normalizeActionsMap(rowActions, role) {
  const base = cloneDefaultActions(role);
  if (!rowActions || typeof rowActions !== 'object') return base;
  for (const perm of ACTION_KEYS) {
    if (rowActions[perm] === false) base[perm] = false;
    else if (rowActions[perm] === true) base[perm] = true;
  }
  if (roleKeyForActions(role) === 'editor') {
    for (const locked of EDITOR_LOCKED_ACTIONS) {
      base[locked] = true;
    }
  }
  return base;
}

function hasActionPermission(actionsMap, permission) {
  if (!permission) return false;
  if (!actionsMap || typeof actionsMap !== 'object') return false;
  return actionsMap[permission] === true;
}

function validateActionsMatrix(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'INVALID_ACTION_CAPS' };
  }
  const data = {};
  for (const role of ACTION_ROLES) {
    const block = body[role];
    if (!block || typeof block !== 'object') {
      return { ok: false, error: 'INVALID_ACTION_CAPS' };
    }
    const normalized = {};
    for (const perm of ACTION_KEYS) {
      if (typeof block[perm] !== 'boolean') {
        return { ok: false, error: 'INVALID_ACTION_CAPS' };
      }
      normalized[perm] = block[perm];
    }
    if (role === 'editor') {
      for (const locked of EDITOR_LOCKED_ACTIONS) {
        normalized[locked] = true;
      }
    }
    data[role] = normalized;
  }
  return { ok: true, data };
}

function buildDefaultMatrix() {
  const data = {};
  for (const role of ACTION_ROLES) {
    data[role] = cloneDefaultActions(role);
  }
  return data;
}

module.exports = {
  ACTION_ROLES,
  ACTION_KEYS,
  ACTION_GROUPS,
  EDITOR_LOCKED_ACTIONS,
  DEFAULT_ACTIONS_BY_ROLE,
  roleKeyForActions,
  cloneDefaultActions,
  normalizeActionsMap,
  hasActionPermission,
  validateActionsMatrix,
  buildDefaultMatrix,
  PERMISSIONS
};
