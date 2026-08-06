/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/auth-service');
const legalPackService = require('../services/legalPackService');

async function requireEditor(req, res) {
  if (!req.session || !req.session.authenticated) {
    res.status(401).json({ error: 'Требуется аутентификация' });
    return null;
  }
  if (!req.session.address) {
    res.status(403).json({ error: 'Требуется подключение кошелька' });
    return null;
  }
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess || userAccessLevel.level !== 'editor') {
    res.status(403).json({ error: 'Требуются права редактора' });
    return null;
  }
  return userAccessLevel;
}

router.get('/', async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    res.json(legalPackService.listPacks());
  } catch (e) {
    console.error('[legal-packs] list', e);
    res.status(500).json({ error: e.message || 'Ошибка списка пакетов' });
  }
});

/** Публично: какой пакет сейчас активен на инстансе (для хаба published). */
router.get('/active', async (req, res) => {
  try {
    res.json(await legalPackService.getActivePackPublic());
  } catch (e) {
    console.error('[legal-packs] active', e);
    res.status(500).json({ error: e.message || 'Ошибка active pack' });
  }
});

router.get('/operator-settings', async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    res.json(await legalPackService.getOperatorSettings());
  } catch (e) {
    console.error('[legal-packs] get operator-settings', e);
    res.status(500).json({ error: e.message || 'Ошибка чтения реквизитов' });
  }
});

router.put('/operator-settings', async (req, res) => {
  try {
    const access = await requireEditor(req, res);
    if (!access) return;
    const body = req.body || {};
    const saved = await legalPackService.saveOperatorSettings({
      jurisdiction: body.jurisdiction,
      packId: body.packId,
      variables: body.variables,
      updatedBy: req.session.address,
    });
    res.json(saved);
  } catch (e) {
    console.error('[legal-packs] put operator-settings', e);
    res.status(500).json({ error: e.message || 'Ошибка сохранения реквизитов' });
  }
});

router.get('/by-jurisdiction/:numeric', async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const pack = legalPackService.getPackByJurisdiction(req.params.numeric);
    res.json(pack);
  } catch (e) {
    const status = e.status || 500;
    if (status === 404) return res.status(404).json({ error: e.message });
    console.error('[legal-packs] by-jurisdiction', e);
    res.status(500).json({ error: e.message || 'Ошибка пакета' });
  }
});

router.get('/:packId', async (req, res) => {
  try {
    if (!(await requireEditor(req, res))) return;
    const pack = legalPackService.getPackManifest(req.params.packId);
    res.json(pack);
  } catch (e) {
    const status = e.status || 500;
    if (status === 404) return res.status(404).json({ error: e.message });
    console.error('[legal-packs] get', e);
    res.status(500).json({ error: e.message || 'Ошибка пакета' });
  }
});

router.post('/:packId/generate', async (req, res) => {
  try {
    const access = await requireEditor(req, res);
    if (!access) return;
    const body = req.body || {};
    const variables = body.variables || {};
    const result = await legalPackService.generatePack(req.params.packId, {
      variables,
      documentIds: body.documentIds,
      mode: body.mode || 'missing_only',
    });
    // после успешной генерации сохраняем реквизиты (чтобы не терять при сбое/перезагрузке)
    try {
      await legalPackService.saveOperatorSettings({
        jurisdiction: body.jurisdiction || null,
        packId: req.params.packId,
        variables,
        updatedBy: req.session.address,
      });
    } catch (saveErr) {
      console.warn('[legal-packs] auto-save operator settings failed:', saveErr.message);
    }
    res.json(result);
  } catch (e) {
    const status = e.status || 500;
    if (status === 400) {
      return res.status(400).json({ error: e.message, missing: e.missing || [] });
    }
    if (status === 404) return res.status(404).json({ error: e.message });
    console.error('[legal-packs] generate', e);
    res.status(500).json({ error: e.message || 'Ошибка генерации' });
  }
});

module.exports = router;
