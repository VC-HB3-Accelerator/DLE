/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Права и scope для страниц / объявлений (admin_pages_simple).
 */

const db = require('../db');
const { PERMISSIONS } = require('/app/shared/permissions');
const accessResolver = require('./accessResolverService');
const { getLinkedWallet } = require('./wallet-service');

const PAGE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
});

function hasPerm(access, permission) {
  return accessResolver.hasActionPermission(access, permission);
}

function canManageLegalGlobal(access) {
  return access?.dataScope === 'global' && hasPerm(access, PERMISSIONS.MANAGE_LEGAL_DOCS);
}

/** Редактор может одобрять/отклонять публикации в публичный блог/магазин. */
function canApprovePublications(access) {
  if (!access) return false;
  if (canManageLegalGlobal(access)) return true;
  if (access.dataScope === 'domain' && hasPerm(access, PERMISSIONS.APPROVE_DOMAIN_PUBLICATIONS)) {
    return true;
  }
  return false;
}

/** Прямая публикация без очереди — только глобальный редактор. */
function canPublishDirectly(access) {
  return canManageLegalGlobal(access);
}

function normalizePageStatus(raw, { allowPublished = false } = {}) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === PAGE_STATUSES.DRAFT) return PAGE_STATUSES.DRAFT;
  if (s === PAGE_STATUSES.PENDING) return PAGE_STATUSES.PENDING;
  if (s === PAGE_STATUSES.REJECTED) return PAGE_STATUSES.REJECTED;
  if (s === PAGE_STATUSES.PUBLISHED && allowPublished) return PAGE_STATUSES.PUBLISHED;
  return PAGE_STATUSES.DRAFT;
}

/**
 * Статус при создании/сохранении автором (не редактором):
 * submitForReview → pending, иначе draft.
 */
function resolveAuthorWriteStatus(requestedStatus, { submitForReview = false } = {}) {
  if (submitForReview) return PAGE_STATUSES.PENDING;
  const s = normalizePageStatus(requestedStatus, { allowPublished: false });
  if (s === PAGE_STATUSES.PENDING) return PAGE_STATUSES.PENDING;
  if (s === PAGE_STATUSES.REJECTED) return PAGE_STATUSES.DRAFT;
  return PAGE_STATUSES.DRAFT;
}

function pageMatchesScope(access, page, viewerUserId) {
  if (!page || !access) return false;
  if (canManageLegalGlobal(access)) return true;

  const ownerId = page.owner_user_id;
  const ownerDomain = page.owner_domain;

  if (ownerId == null && !ownerDomain) {
    return canManageLegalGlobal(access);
  }

  if (access.dataScope === 'own') {
    return Number(ownerId) === Number(viewerUserId);
  }

  if (access.dataScope === 'domain' && access.domain) {
    return String(ownerDomain || '').toLowerCase() === String(access.domain).toLowerCase();
  }

  return access.dataScope === 'global';
}

function canCreatePage(access) {
  if (!access) return false;
  if (canManageLegalGlobal(access)) return true;
  if (hasPerm(access, PERMISSIONS.CREATE_OWN_ARTICLES)) {
    return access.dataScope === 'own' || access.dataScope === 'domain';
  }
  return false;
}

function canWritePage(access, page, viewerUserId) {
  if (!access) return false;
  if (canManageLegalGlobal(access)) return true;

  if (!page) {
    return canCreatePage(access);
  }

  if (!pageMatchesScope(access, page, viewerUserId)) {
    return false;
  }

  if (access.dataScope === 'own' && hasPerm(access, PERMISSIONS.CREATE_OWN_ARTICLES)) {
    return true;
  }

  if (access.dataScope === 'domain') {
    return hasPerm(access, PERMISSIONS.APPROVE_DOMAIN_PUBLICATIONS)
      || hasPerm(access, PERMISSIONS.VIEW_DOMAIN_ARTICLES)
      || hasPerm(access, PERMISSIONS.CREATE_OWN_ARTICLES);
  }

  return false;
}

function canListPages(access) {
  if (!access) return false;
  if (canManageLegalGlobal(access)) return true;
  if (canApprovePublications(access)) return true;
  if (canCreatePage(access)) return true;
  if (access.dataScope === 'domain') {
    return hasPerm(access, PERMISSIONS.VIEW_DOMAIN_ARTICLES)
      || hasPerm(access, PERMISSIONS.APPROVE_DOMAIN_PUBLICATIONS);
  }
  return false;
}

/**
 * SQL-фильтр списка страниц admin_pages_simple.
 * @returns {number} next param index
 */
function appendPagesScopeWhere(access, viewerUserId, where, params, idx) {
  if (!access || access.dataScope === 'global') {
    return idx;
  }
  if (access.dataScope === 'domain' && access.domain) {
    where.push(`owner_domain = $${idx++}`);
    params.push(access.domain);
    return idx;
  }
  where.push(`owner_user_id = $${idx++}`);
  params.push(viewerUserId);
  return idx;
}

async function resolveViewerAccess(req) {
  const userId = req.session?.userId;
  if (!userId) return null;
  return accessResolver.resolveAccess(userId);
}

async function resolveAuthorAddress(req) {
  if (req.session?.address) return req.session.address;
  const userId = req.session?.userId;
  if (!userId) return null;
  const wallet = await getLinkedWallet(userId);
  if (wallet) return wallet;
  return `user:${userId}`;
}

async function loadPageRow(pageId) {
  const id = parseInt(pageId, 10);
  if (!id || Number.isNaN(id)) return null;
  const { rows } = await db.getQuery()(
    'SELECT * FROM admin_pages_simple WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  PAGE_STATUSES,
  canCreatePage,
  canWritePage,
  canListPages,
  canManageLegalGlobal,
  canApprovePublications,
  canPublishDirectly,
  normalizePageStatus,
  resolveAuthorWriteStatus,
  pageMatchesScope,
  appendPagesScopeWhere,
  resolveViewerAccess,
  resolveAuthorAddress,
  loadPageRow,
};
