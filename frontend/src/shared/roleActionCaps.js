/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Копия shared/roleActionCaps.js для Vite.
 */

import {
  PERMISSIONS,
  PERMISSIONS_MAP,
  ROLES
} from './permissions.js';

export const ACTION_ROLES = Object.freeze(['guest', 'user', 'readonly', 'editor']);

export const ACTION_KEYS = Object.freeze(Object.values(PERMISSIONS));

export const EDITOR_LOCKED_ACTIONS = Object.freeze([PERMISSIONS.MANAGE_SETTINGS]);

export const ACTION_GROUPS = Object.freeze([
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
  },
  {
    id: 'own',
    keys: Object.freeze([
      PERMISSIONS.CREATE_OWN_ARTICLES,
      PERMISSIONS.MANAGE_OWN_CONTACTS,
      PERMISSIONS.IMPORT_OWN_CONTACTS,
      PERMISSIONS.BROADCAST_OWN_CONTACTS
    ])
  },
  {
    id: 'domain',
    keys: Object.freeze([
      PERMISSIONS.VIEW_DOMAIN_CONTACTS,
      PERMISSIONS.EDIT_DOMAIN_CONTACTS,
      PERMISSIONS.VIEW_DOMAIN_ARTICLES,
      PERMISSIONS.APPROVE_DOMAIN_PUBLICATIONS,
      PERMISSIONS.MANAGE_DOMAIN_AUTH
    ])
  }
]);

export function roleKeyForActions(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === ROLES.USER || r === 'user') return 'user';
  if (r === ROLES.READONLY || r === 'readonly') return 'readonly';
  if (r === ROLES.EDITOR || r === 'editor') return 'editor';
  return 'guest';
}

export function cloneDefaultActions(role) {
  const key = roleKeyForActions(role);
  const list = PERMISSIONS_MAP[key] || PERMISSIONS_MAP[ROLES.GUEST] || [];
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

export function normalizeActionsMap(rowActions, role) {
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

export function hasActionPermission(actionsMap, permission) {
  if (!permission) return false;
  if (!actionsMap || typeof actionsMap !== 'object') return false;
  return actionsMap[permission] === true;
}

export function validateActionsMatrix(body) {
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

export function buildDefaultMatrix() {
  const data = {};
  for (const role of ACTION_ROLES) {
    data[role] = cloneDefaultActions(role);
  }
  return data;
}

export { PERMISSIONS };
