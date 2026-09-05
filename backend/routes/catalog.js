/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const catalogFilters = require('../services/catalogFiltersService');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { hasPermission, PERMISSIONS } = require('/app/shared/permissions');
const db = require('../db');

const router = express.Router();

function parseBool(v) {
  return v === '1' || v === 'true' || v === true || v === 'yes';
}

async function userIsEditor(req) {
  const userId = req.session?.userId || null;
  if (!userId) return false;
  try {
    const { rows } = await db.getQuery()(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const role = rows[0]?.role || 'user';
    return hasPermission(role, PERMISSIONS.MANAGE_LEGAL_DOCS);
  } catch {
    return false;
  }
}

/** Публичные фильтры: разделы + значения по ключам раздела */
router.get('/filters', async (req, res) => {
  try {
    const facets = { ...req.query };
    delete facets.only_used;
    delete facets.scope;
    delete facets.q;
    const data = await catalogFilters.getLinkedFiltersPayload({
      facets,
      onlyUsed: parseBool(req.query.only_used),
      scope: ['store', 'blog', 'both'].includes(String(req.query.scope || ''))
        ? String(req.query.scope)
        : 'both',
    });
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('[catalog] filters error:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.get('/sections', async (req, res) => {
  try {
    const activeOnly = !parseBool(req.query.all);
    const sections = await catalogFilters.listSections({ activeOnly });
    res.json({ success: true, sections });
  } catch (error) {
    logger.error('[catalog] sections list:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.get('/admin/taxonomy', requireAuth, async (req, res) => {
  try {
    if (!(await userIsEditor(req))) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }
    const data = await catalogFilters.getAdminTaxonomy();
    res.json({ success: true, ...data });
  } catch (error) {
    logger.error('[catalog] admin taxonomy get:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.post('/admin/sections', requireAuth, async (req, res) => {
  try {
    if (!(await userIsEditor(req))) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }
    const section = await catalogFilters.createSection(req.body || {});
    const data = await catalogFilters.getAdminTaxonomy();
    res.json({ success: true, section, ...data });
  } catch (error) {
    logger.error('[catalog] create section:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.put('/admin/sections/:id', requireAuth, async (req, res) => {
  try {
    if (!(await userIsEditor(req))) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }
    const section = await catalogFilters.updateSection(req.params.id, req.body || {});
    const data = await catalogFilters.getAdminTaxonomy();
    res.json({ success: true, section, ...data });
  } catch (error) {
    logger.error('[catalog] update section:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.delete('/admin/sections/:id', requireAuth, async (req, res) => {
  try {
    if (!(await userIsEditor(req))) {
      return res.status(403).json({ success: false, error: 'Нет прав' });
    }
    const result = await catalogFilters.deleteSection(req.params.id, {
      hard: parseBool(req.query.hard),
    });
    const data = await catalogFilters.getAdminTaxonomy();
    res.json({ success: true, ...result, ...data });
  } catch (error) {
    logger.error('[catalog] delete section:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

module.exports = router;
