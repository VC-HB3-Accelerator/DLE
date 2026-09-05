/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * CRUD для auth_email_domain_rules (TZ §4.2, фаза A).
 */

const db = require('../db');
const logger = require('../utils/logger');
const { ROLES } = require('/app/shared/permissions');
const contactProvenanceService = require('./contactProvenanceService');
const accessResolverService = require('./accessResolverService');
const roleActionCapabilitiesService = require('./roleActionCapabilitiesService');

const MANAGE_DOMAIN_AUTH = 'manage_domain_auth';
const ALLOWED_ROLES = new Set(['user', 'readonly']);

function normalizeDomain(value) {
  let v = String(value || '').trim().toLowerCase();
  if (v.startsWith('@')) v = v.slice(1);
  return v;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function domainFromRule(kind, value) {
  if (kind === 'domain') return normalizeDomain(value);
  return contactProvenanceService.extractDomain(value);
}

function isValidDomain(domain) {
  if (!domain || domain.includes('@')) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

function isValidEmail(email) {
  if (!email || !email.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isPlatformEditor(access) {
  if (!access) return false;
  return access.role === ROLES.EDITOR
    || access.tokenRole === ROLES.EDITOR
    || access.tokenRole === 'editor';
}

async function canManageDomainAuth(access) {
  if (!access?.isDomainAdmin) return false;
  try {
    return await roleActionCapabilitiesService.roleHasPermission(access.role, MANAGE_DOMAIN_AUTH);
  } catch {
    return false;
  }
}

async function assertCanManageRule(access, kind, value, { isCreate = false } = {}) {
  if (!access) {
    const err = new Error('Требуется аутентификация');
    err.status = 401;
    throw err;
  }

  if (isPlatformEditor(access)) return;

  const domainAdminCanManage = await canManageDomainAuth(access);
  if (!domainAdminCanManage) {
    const err = new Error('Доступ запрещен');
    err.status = 403;
    throw err;
  }

  const ruleDomain = domainFromRule(kind, value);
  if (!access.domain || ruleDomain !== access.domain) {
    const err = new Error('Можно управлять только правилами своего корпоративного домена');
    err.status = 403;
    throw err;
  }

  if (isCreate && kind === 'domain') {
    const { rows } = await db.getQuery()(
      `SELECT COUNT(*)::int AS c FROM auth_email_domain_rules WHERE kind = 'domain'`
    );
    if ((rows[0]?.c || 0) === 0) {
      const err = new Error('Первое правило домена может создать только platform editor');
      err.status = 403;
      throw err;
    }
  }
}

function normalizeRuleInput(body) {
  const kind = String(body?.kind || '').trim().toLowerCase();
  if (kind !== 'domain' && kind !== 'email') {
    const err = new Error('kind должен быть domain или email');
    err.status = 400;
    throw err;
  }

  let value;
  if (kind === 'domain') {
    value = normalizeDomain(body?.value);
    if (!isValidDomain(value)) {
      const err = new Error('Некорректный домен (например company.com)');
      err.status = 400;
      throw err;
    }
  } else {
    value = normalizeEmail(body?.value);
    if (!isValidEmail(value)) {
      const err = new Error('Некорректный email');
      err.status = 400;
      throw err;
    }
  }

  const role = String(body?.role || 'user').trim().toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    const err = new Error('role может быть только user или readonly');
    err.status = 400;
    throw err;
  }

  let domainAdmin = Boolean(body?.domain_admin ?? body?.domainAdmin);
  if (kind === 'domain') {
    domainAdmin = false;
  } else if (domainAdmin && role !== 'readonly') {
    const err = new Error('domain_admin доступен только для email с role=readonly (boss@)');
    err.status = 400;
    throw err;
  }

  return { kind, value, role, domain_admin: domainAdmin };
}

function filterRulesForViewer(rows, access) {
  if (!access || isPlatformEditor(access)) return rows;
  if (!access.domain) return [];
  return rows.filter((row) => domainFromRule(row.kind, row.value) === access.domain);
}

async function listRules(viewerAccess) {
  await accessResolverService.ensureTables();
  const { rows } = await db.getQuery()(
    `SELECT id, kind, value, role, domain_admin, updated_by, created_at, updated_at
     FROM auth_email_domain_rules
     ORDER BY kind, value`
  );
  return filterRulesForViewer(rows, viewerAccess);
}

async function createRule(body, viewerAccess, updatedBy = null) {
  await accessResolverService.ensureTables();
  const input = normalizeRuleInput(body);
  await assertCanManageRule(viewerAccess, input.kind, input.value, { isCreate: true });

  if (input.domain_admin && !isPlatformEditor(viewerAccess)) {
    const { rows } = await db.getQuery()(
      `SELECT COUNT(*)::int AS c FROM auth_email_domain_rules
       WHERE kind = 'email' AND domain_admin = TRUE
         AND value LIKE $1`,
      [`%@${input.value.split('@')[1]}`]
    );
    if ((rows[0]?.c || 0) === 0) {
      const err = new Error('Первый boss@ для домена может создать только platform editor');
      err.status = 403;
      throw err;
    }
  }

  try {
    const { rows } = await db.getQuery()(
      `INSERT INTO auth_email_domain_rules (kind, value, role, domain_admin, updated_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, kind, value, role, domain_admin, updated_by, created_at, updated_at`,
      [input.kind, input.value, input.role, input.domain_admin, updatedBy || null]
    );
    logger.info(
      `[authDomainRules] created ${input.kind}=${input.value} by user ${updatedBy || 'unknown'}`
    );
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Такое правило уже существует');
      err.status = 409;
      throw err;
    }
    if (error.code === '23514') {
      const err = new Error('role может быть только user или readonly');
      err.status = 400;
      throw err;
    }
    throw error;
  }
}

async function updateRule(id, body, viewerAccess, updatedBy = null) {
  await accessResolverService.ensureTables();
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) {
    const err = new Error('Некорректный id');
    err.status = 400;
    throw err;
  }

  const existing = await db.getQuery()(
    `SELECT id, kind, value, role, domain_admin FROM auth_email_domain_rules WHERE id = $1`,
    [ruleId]
  );
  if (!existing.rows[0]) {
    const err = new Error('Правило не найдено');
    err.status = 404;
    throw err;
  }

  const current = existing.rows[0];
  await assertCanManageRule(viewerAccess, current.kind, current.value);

  const input = normalizeRuleInput({
    kind: body?.kind ?? current.kind,
    value: body?.value ?? current.value,
    role: body?.role ?? current.role,
    domain_admin: body?.domain_admin ?? body?.domainAdmin ?? current.domain_admin,
  });

  if (input.kind !== current.kind || input.value !== current.value) {
    await assertCanManageRule(viewerAccess, input.kind, input.value, { isCreate: true });
  }

  if (input.domain_admin && !current.domain_admin && !isPlatformEditor(viewerAccess)) {
    const err = new Error('Назначить boss@ может только platform editor');
    err.status = 403;
    throw err;
  }

  try {
    const { rows } = await db.getQuery()(
      `UPDATE auth_email_domain_rules
       SET kind = $2, value = $3, role = $4, domain_admin = $5, updated_by = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, kind, value, role, domain_admin, updated_by, created_at, updated_at`,
      [ruleId, input.kind, input.value, input.role, input.domain_admin, updatedBy || null]
    );
    logger.info(`[authDomainRules] updated id=${ruleId} by user ${updatedBy || 'unknown'}`);
    return rows[0];
  } catch (error) {
    if (error.code === '23505') {
      const err = new Error('Такое правило уже существует');
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

async function deleteRule(id, viewerAccess, updatedBy = null) {
  await accessResolverService.ensureTables();
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) {
    const err = new Error('Некорректный id');
    err.status = 400;
    throw err;
  }

  const existing = await db.getQuery()(
    `SELECT id, kind, value FROM auth_email_domain_rules WHERE id = $1`,
    [ruleId]
  );
  if (!existing.rows[0]) {
    const err = new Error('Правило не найдено');
    err.status = 404;
    throw err;
  }

  await assertCanManageRule(viewerAccess, existing.rows[0].kind, existing.rows[0].value);

  await db.getQuery()(`DELETE FROM auth_email_domain_rules WHERE id = $1`, [ruleId]);
  logger.info(`[authDomainRules] deleted id=${ruleId} by user ${updatedBy || 'unknown'}`);
  return { id: ruleId };
}

async function recheckRolesAfterChange() {
  try {
    const emailResult = await accessResolverService.recomputeAllWithEmailIdentities();
    const walletResult = await accessResolverService.recomputeAllWithWallets();
    logger.info(
      `[authDomainRules] recheck: email ${emailResult.updated}/${emailResult.total}, wallets ${walletResult.updated}/${walletResult.total}`
    );
    return { emailResult, walletResult };
  } catch (error) {
    logger.error('[authDomainRules] recheck failed:', error.message);
    throw error;
  }
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  recheckRolesAfterChange,
  normalizeRuleInput,
  isPlatformEditor,
  canManageDomainAuth,
};
