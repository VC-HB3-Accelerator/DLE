/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Единая точка: роль (users.role) + dataScope для CRM/ленты.
 * TZ: A0 + задел под auth_email_domain_rules (этап A).
 */

const db = require('../db');
const logger = require('../utils/logger');
const { ROLES, PERMISSIONS } = require('/app/shared/permissions');
const { getLinkedWallet } = require('./wallet-service');
const identityService = require('./identity-service');
const roleActionCapabilitiesService = require('./roleActionCapabilitiesService');
const contactProvenanceService = require('./contactProvenanceService');

const ROLE_RANK = Object.freeze({
  [ROLES.GUEST]: 0,
  guest: 0,
  [ROLES.USER]: 1,
  user: 1,
  [ROLES.READONLY]: 2,
  readonly: 2,
  [ROLES.EDITOR]: 3,
  editor: 3,
});

const DOMAIN_VIEW_PERMISSION = 'view_domain_contacts';

let tablesReady = false;

function rankRole(role) {
  return ROLE_RANK[role] ?? ROLE_RANK.user;
}

function maxRole(a, b) {
  return rankRole(a) >= rankRole(b) ? a : b;
}

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === ROLES.EDITOR || r === 'editor') return ROLES.EDITOR;
  if (r === ROLES.READONLY || r === 'readonly') return ROLES.READONLY;
  if (r === ROLES.GUEST || r === 'guest') return ROLES.GUEST;
  return ROLES.USER;
}

async function ensureTables() {
  if (tablesReady) return;
  const { pool } = require('../db');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_email_domain_rules (
      id SERIAL PRIMARY KEY,
      kind VARCHAR(16) NOT NULL CHECK (kind IN ('domain', 'email')),
      value TEXT NOT NULL,
      role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'readonly')),
      domain_admin BOOLEAN NOT NULL DEFAULT FALSE,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(kind, value)
    )
  `);
  await pool.query(`
    ALTER TABLE auth_email_domain_rules
      ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_email_domain_rules_kind_value
      ON auth_email_domain_rules (kind, value)
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_email_registration_policy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      require_listed_domain BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  await pool.query(`
    INSERT INTO auth_email_registration_policy (id, require_listed_domain)
    VALUES (1, TRUE)
    ON CONFLICT (id) DO NOTHING
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_provenance (
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      imported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_domain TEXT,
      source VARCHAR(32) NOT NULL DEFAULT 'import',
      job_id INTEGER REFERENCES contact_import_jobs(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (contact_user_id, imported_by)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_contact_provenance_imported_by
      ON contact_provenance (imported_by)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_contact_provenance_owner_domain
      ON contact_provenance (owner_domain)
  `);
  tablesReady = true;
  try {
    const contactProvenanceService = require('./contactProvenanceService');
    await contactProvenanceService.ensureMultiListSchema();
  } catch (e) {
    logger.warn('[accessResolver] provenance migrate:', e.message);
  }
}

async function lookupDomainRule(domain) {
  if (!domain) return ROLES.USER;
  const { rows } = await db.getQuery()(
    `SELECT role FROM auth_email_domain_rules
     WHERE kind = 'domain' AND value = $1
     LIMIT 1`,
    [domain.toLowerCase()]
  );
  return normalizeRole(rows[0]?.role || ROLES.USER);
}

async function lookupEmailRules(primaryEmail) {
  if (!primaryEmail) {
    return {
      emailRole: ROLES.USER,
      domainAdmin: false,
      domain: null,
    };
  }
  const email = String(primaryEmail).trim().toLowerCase();
  const domain = contactProvenanceService.extractDomain(email);

  const { rows: emailRows } = await db.getQuery()(
    `SELECT role, domain_admin FROM auth_email_domain_rules
     WHERE kind = 'email' AND value = $1
     LIMIT 1`,
    [email]
  );
  if (emailRows[0]) {
    return {
      emailRole: normalizeRole(emailRows[0].role),
      domainAdmin: Boolean(emailRows[0].domain_admin),
      domain,
    };
  }

  if (domain) {
    return {
      emailRole: await lookupDomainRule(domain),
      domainAdmin: false,
      domain,
    };
  }

  return { emailRole: ROLES.USER, domainAdmin: false, domain: null };
}

async function resolveTokenRole(userId) {
  const wallet = await getLinkedWallet(userId);
  if (!wallet) {
    return { tokenRole: ROLES.USER, hasWallet: false, wallet: null, accessLevel: null };
  }
  const authService = require('./auth-service');
  const accessLevel = await authService.getUserAccessLevel(wallet);
  const tokenRole = normalizeRole(accessLevel?.level || ROLES.USER);
  return { tokenRole, hasWallet: true, wallet, accessLevel };
}

async function hasDomainViewPermission(role) {
  try {
    return await roleActionCapabilitiesService.roleHasPermission(role, DOMAIN_VIEW_PERMISSION);
  } catch {
    return false;
  }
}

/**
 * @param {number|null|undefined} userId
 * @returns {Promise<object>}
 */
async function resolveAccess(userId) {
  await ensureTables();

  if (!userId) {
    return {
      role: ROLES.GUEST,
      tokenRole: null,
      emailRole: ROLES.USER,
      dataScope: 'none',
      domain: null,
      isDomainAdmin: false,
      permissions: {},
    };
  }

  const { tokenRole, hasWallet } = await resolveTokenRole(userId);
  const primaryEmail = await identityService.getPrimaryIdentityValue(userId, 'email');
  const emailRules = await lookupEmailRules(primaryEmail);
  const domain = emailRules.domain;

  let effectiveEmailRole = emailRules.emailRole;
  if (emailRules.domainAdmin) {
    if (hasWallet && rankRole(tokenRole) >= rankRole(ROLES.READONLY)) {
      effectiveEmailRole = ROLES.READONLY;
    } else {
      effectiveEmailRole = await lookupDomainRule(domain);
    }
  }

  const role = maxRole(tokenRole, effectiveEmailRole);

  const isDomainAdmin = Boolean(
    emailRules.domainAdmin
    && hasWallet
    && rankRole(tokenRole) >= rankRole(ROLES.READONLY)
    && role !== ROLES.EDITOR
  );

  let dataScope = 'own';
  if (role === ROLES.EDITOR || tokenRole === ROLES.EDITOR) {
    dataScope = 'global';
  } else if (isDomainAdmin && domain && (await hasDomainViewPermission(role))) {
    dataScope = 'domain';
  }

  let permissions = {};
  try {
    permissions = await roleActionCapabilitiesService.getActionsForUi(role);
  } catch (error) {
    logger.warn('[accessResolver] permissions:', error.message);
  }

  return {
    role,
    tokenRole,
    emailRole: effectiveEmailRole,
    dataScope,
    domain,
    isDomainAdmin,
    permissions,
  };
}

/**
 * Единственная точка записи users.role (TZ §6).
 * @returns {Promise<object>} resolveAccess result
 */
async function recompute(userId) {
  if (!userId) return resolveAccess(null);
  const access = await resolveAccess(userId);
  try {
    const { rows } = await db.getQuery()(
      `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role`,
      [access.role, userId]
    );
    if (!rows[0]) {
      logger.warn(`[accessResolver] recompute: user ${userId} not found`);
    }
  } catch (error) {
    logger.error(`[accessResolver] recompute user ${userId}:`, error.message);
    throw error;
  }
  return access;
}

async function recomputeAllWithWallets() {
  await ensureTables();
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_identities ui ON ui.user_id = u.id
     WHERE ui.provider_encrypted = encrypt_text('wallet', $1)`,
    [encryptionKey]
  );
  let updated = 0;
  for (const row of rows) {
    try {
      const before = await db.getQuery()('SELECT role FROM users WHERE id = $1', [row.id]);
      const access = await recompute(row.id);
      if (before.rows[0]?.role !== access.role) updated += 1;
    } catch (error) {
      logger.error(`[accessResolver] recompute wallet user ${row.id}:`, error.message);
    }
  }
  return { total: rows.length, updated };
}

async function recomputeAllWithEmailIdentities() {
  await ensureTables();
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT DISTINCT user_id AS id
     FROM user_identities
     WHERE provider_encrypted = encrypt_text('email', $1)`,
    [encryptionKey]
  );
  let updated = 0;
  for (const row of rows) {
    try {
      const before = await db.getQuery()('SELECT role FROM users WHERE id = $1', [row.id]);
      const access = await recompute(row.id);
      if (before.rows[0]?.role !== access.role) updated += 1;
    } catch (error) {
      logger.error(`[accessResolver] recompute email user ${row.id}:`, error.message);
    }
  }
  return { total: rows.length, updated };
}

/**
 * Primary email на домене зрителя (Boss@company.com → все @company.com).
 */
async function contactPrimaryEmailOnDomain(contactUserId, domain) {
  if (!contactUserId || !domain) return false;
  const email = await identityService.getPrimaryIdentityValue(contactUserId, 'email');
  if (!email || !String(email).includes('@')) return false;
  const emailDomain = String(email).split('@').pop().toLowerCase();
  return emailDomain === String(domain).toLowerCase();
}

/**
 * SQL-фильтр списка CRM (users u).
 * own: я + imported_by + platform editor.
 * domain: все с primary email @domain + provenance.owner_domain + platform editor (+ я).
 * @returns {number} next param index
 */
function appendContactsScopeWhere(access, viewerUserId, where, params, idx) {
  if (!access || access.dataScope === 'global') {
    return idx;
  }
  if (access.dataScope === 'domain' && access.domain) {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const domainParam = idx;
    const key1 = idx + 1;
    const key2 = idx + 2;
    const viewerParam = idx + 3;
    where.push(`(
      u.id = $${viewerParam}
      OR u.role = 'editor'
      OR EXISTS (
        SELECT 1 FROM user_identities ui
        WHERE ui.user_id = u.id
          AND ui.is_primary = true
          AND ui.provider_encrypted = encrypt_text('email', $${key1})
          AND lower(split_part(decrypt_text(ui.provider_id_encrypted, $${key2}), '@', 2))
            = lower($${domainParam})
      )
      OR EXISTS (
        SELECT 1 FROM contact_provenance cp
        WHERE cp.contact_user_id = u.id
          AND lower(cp.owner_domain) = lower($${domainParam})
      )
    )`);
    params.push(
      String(access.domain).toLowerCase(),
      encryptionKey,
      encryptionKey,
      viewerUserId
    );
    return idx + 4;
  }
  where.push(`(
    u.id = $${idx}
    OR u.role = 'editor'
    OR EXISTS (
      SELECT 1 FROM contact_provenance cp
      WHERE cp.contact_user_id = u.id AND cp.imported_by = $${idx}
    )
  )`);
  params.push(viewerUserId);
  return idx + 1;
}

async function canViewContact(access, contactUserId, viewerUserId) {
  if (!access) return false;
  if (access.dataScope === 'global') return true;
  if (Number(contactUserId) === Number(viewerUserId)) return true;

  const { rows: roleRows } = await db.getQuery()(
    `SELECT role FROM users WHERE id = $1 LIMIT 1`,
    [contactUserId]
  );
  if (roleRows[0]?.role === ROLES.EDITOR || roleRows[0]?.role === 'editor') {
    return true;
  }

  if (access.dataScope === 'domain' && access.domain) {
    if (await contactPrimaryEmailOnDomain(contactUserId, access.domain)) {
      return true;
    }
    const { rows } = await db.getQuery()(
      `SELECT 1 FROM contact_provenance
       WHERE contact_user_id = $1 AND lower(owner_domain) = lower($2)
       LIMIT 1`,
      [contactUserId, access.domain]
    );
    return Boolean(rows[0]);
  }

  const { rows } = await db.getQuery()(
    `SELECT 1 FROM contact_provenance
     WHERE contact_user_id = $1 AND imported_by = $2
     LIMIT 1`,
    [contactUserId, viewerUserId]
  );
  return Boolean(rows[0]);
}

async function canEditContact(access, contactUserId, viewerUserId) {
  if (!canEditContacts(access)) return false;
  return canViewContact(access, contactUserId, viewerUserId);
}

function hasActionPermission(access, permission) {
  return Boolean(access?.permissions?.[permission]);
}

function canImportContacts(access) {
  if (!access) return false;
  if (access.dataScope === 'global' && hasActionPermission(access, PERMISSIONS.EDIT_CONTACTS)) {
    return true;
  }
  if (hasActionPermission(access, PERMISSIONS.IMPORT_OWN_CONTACTS)) {
    return access.dataScope === 'own' || access.dataScope === 'domain' || access.dataScope === 'global';
  }
  if (access.dataScope === 'domain' && hasActionPermission(access, PERMISSIONS.EDIT_DOMAIN_CONTACTS)) {
    return true;
  }
  return false;
}

function canEditContacts(access) {
  if (!access) return false;
  if (access.dataScope === 'global' && hasActionPermission(access, PERMISSIONS.EDIT_CONTACTS)) {
    return true;
  }
  if (access.dataScope === 'own' && hasActionPermission(access, PERMISSIONS.MANAGE_OWN_CONTACTS)) {
    return true;
  }
  if (access.dataScope === 'domain' && hasActionPermission(access, PERMISSIONS.EDIT_DOMAIN_CONTACTS)) {
    return true;
  }
  return false;
}

/** Platform editor: shared CRM fields (tags/files/block/identities). Boss@ ≠ editor. */
function isPlatformEditor(access) {
  return Boolean(
    access
    && access.dataScope === 'global'
    && hasActionPermission(access, PERMISSIONS.EDIT_CONTACTS)
  );
}

function canBroadcast(access) {
  if (!access) return false;
  if (access.dataScope === 'global' && hasActionPermission(access, PERMISSIONS.BROADCAST)) {
    return true;
  }
  if (hasActionPermission(access, PERMISSIONS.BROADCAST_OWN_CONTACTS)) {
    return access.dataScope === 'own' || access.dataScope === 'domain';
  }
  return false;
}

async function filterContactIdsToScope(access, contactIds, viewerUserId) {
  if (!access || access.dataScope === 'global') {
    return contactIds;
  }
  const out = [];
  for (const id of contactIds) {
    if (await canViewContact(access, id, viewerUserId)) {
      out.push(id);
    }
  }
  return out;
}

function parseProfileOwnerId(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * TZ_PROFILE_OWNED_DATA: доступ к CRM/таблицам/admin-данным профиля.
 * own + чужой :id → 403 (даже при импорте); public лента/магазин этим helper не пользуются.
 * @returns {Promise<{ ok: boolean, status?: number, error?: string, profileId: number|null, access: object|null }>}
 */
async function assertCanAccessProfileOwnedData(viewerUserId, profileIdRaw) {
  const profileId = parseProfileOwnerId(profileIdRaw);
  if (!profileId) {
    return { ok: false, status: 400, error: 'Invalid owner', profileId: null, access: null };
  }
  if (!viewerUserId) {
    return { ok: false, status: 401, error: 'Unauthorized', profileId, access: null };
  }
  const access = await resolveAccess(viewerUserId);
  if (!access || access.dataScope === 'none') {
    return { ok: false, status: 403, error: 'Forbidden', profileId, access };
  }
  const isSelf = Number(profileId) === Number(viewerUserId);
  if (access.dataScope === 'own' && !isSelf) {
    return { ok: false, status: 403, error: 'Forbidden', profileId, access };
  }
  const allowed = await canViewContact(access, profileId, viewerUserId);
  if (!allowed) {
    return { ok: false, status: 403, error: 'Forbidden', profileId, access };
  }
  return { ok: true, profileId, access };
}

function canViewImportJob(access, job, viewerUserId) {
  if (!access || !job) return false;
  if (access.dataScope === 'global' && hasActionPermission(access, PERMISSIONS.EDIT_CONTACTS)) {
    return true;
  }
  if (Number(job.requested_by) === Number(viewerUserId)) {
    return true;
  }
  if (
    access.dataScope === 'domain'
    && access.isDomainAdmin
    && hasActionPermission(access, PERMISSIONS.VIEW_DOMAIN_CONTACTS)
  ) {
    return true;
  }
  return false;
}

function initialize() {
  ensureTables().catch((error) => {
    logger.warn('[accessResolver] initialize failed:', error.message);
  });
}

module.exports = {
  ROLE_RANK,
  ensureTables,
  resolveAccess,
  recompute,
  recomputeAllWithWallets,
  recomputeAllWithEmailIdentities,
  appendContactsScopeWhere,
  canViewContact,
  canEditContact,
  canEditContacts,
  isPlatformEditor,
  canImportContacts,
  canBroadcast,
  filterContactIdsToScope,
  canViewImportJob,
  parseProfileOwnerId,
  assertCanAccessProfileOwnedData,
  hasActionPermission,
  lookupEmailRules,
  initialize,
};
