/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * API закрытой раздачи обновлений: /api/updates/*
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../utils/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const updatesService = require('../services/updatesService');
const updatesApplyService = require('../services/updatesApplyService');
const updatesHubSettingsService = require('../services/updatesHubSettingsService');

/**
 * Сессия пользователя ИЛИ сервисный токен из БД (hub_service_token).
 */
async function requireAuthOrHubToken(req, res, next) {
  try {
    const auth = req.get('authorization') || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      if (token) {
        const settings = await updatesHubSettingsService.getSettings();
        if (settings.hub_service_token && token === settings.hub_service_token) {
          req.hubServiceAuth = true;
          return next();
        }
      }
    }
    return requireAuth(req, res, next);
  } catch (error) {
    return requireAuth(req, res, next);
  }
}

router.get('/latest', async (req, res) => {
  try {
    const hub = await updatesApplyService.getHubBase();
    if (hub) {
      const release = await updatesApplyService.fetchHubLatest();
      if (!release) {
        return res.status(404).json({ success: false, error: 'No published updates' });
      }
      return res.json({
        success: true,
        data: {
          version: release.version,
          minFrom: release.min_from,
          changelog: release.changelog,
          packSha256: release.pack_sha256,
          packSizeBytes: release.pack_size_bytes,
          publishedAt: release.published_at,
          source: 'hub',
        },
      });
    }

    const release = await updatesService.getLatestRelease();
    if (!release) {
      return res.status(404).json({ success: false, error: 'No published updates' });
    }
    return res.json({
      success: true,
      data: {
        version: release.version,
        minFrom: release.min_from,
        changelog: release.changelog,
        packSha256: release.pack_sha256,
        packSizeBytes: release.pack_size_bytes,
        publishedAt: release.published_at,
        source: 'local',
      },
    });
  } catch (error) {
    logger.error('[updates] latest:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to load latest update' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const data = await updatesService.getInstanceStatus();
    const hub = await updatesApplyService.getHubBase();
    if (hub) {
      const release = await updatesApplyService.fetchHubLatest();
      if (release?.version) {
        data.latestVersion = release.version;
        data.minFrom = release.min_from || null;
        data.updateAvailable = Boolean(
          data.currentVersion && release.version !== data.currentVersion
        );
        data.hubUrl = hub;
      }
    } else {
      data.hubUrl = null;
    }
    data.appRootReady = Boolean(updatesApplyService.getAppRoot());
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('[updates] status:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to read instance version' });
  }
});

router.post('/authorize', requireAuthOrHubToken, async (req, res) => {
  try {
    const { dleContract, fromVersion } = req.body || {};
    const walletAddress = req.hubServiceAuth
      ? null
      : (req.session?.address || req.session?.walletAddress || null);
    const data = await updatesService.authorizeDownload({
      dleContract,
      userId: req.hubServiceAuth ? null : (req.session?.userId || null),
      walletAddress,
      req,
    });
    logger.info(
      `[updates] authorize ok hubService=${Boolean(req.hubServiceAuth)} `
      + `user=${req.session?.userId || '-'} dle=${dleContract} from=${fromVersion || '?'}`
    );
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.status || 500;
    logger.warn(`[updates] authorize denied: ${error.message}`);
    return res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/download/:token', async (req, res) => {
  try {
    const file = await updatesService.consumeDownloadToken(req.params.token);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    if (file.sha256) {
      res.setHeader('X-Pack-Sha256', file.sha256);
    }
    res.setHeader('X-Pack-Version', file.version);
    return fs.createReadStream(file.filePath).pipe(res);
  } catch (error) {
    const status = error.status || 500;
    logger.warn(`[updates] download denied: ${error.message}`);
    return res.status(status).json({ success: false, error: error.message });
  }
});

router.post('/apply-here', requireAuth, async (req, res) => {
  try {
    const { dleContract, fromVersion } = req.body || {};
    const walletAddress = req.session?.address || req.session?.walletAddress || null;
    const job = await updatesApplyService.startApplyHere({
      dleContract,
      fromVersion,
      walletAddress,
      userId: req.session?.userId || null,
      req,
    });
    return res.status(202).json({ success: true, data: job });
  } catch (error) {
    const status = error.status || 500;
    logger.warn(`[updates] apply-here: ${error.message}`);
    return res.status(status).json({ success: false, error: error.message });
  }
});

router.get('/apply-here/:jobId', requireAuth, async (req, res) => {
  const job = updatesApplyService.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }
  return res.json({ success: true, data: job });
});

/** Админ: настройки hub / Gitea (БД). */
router.get('/admin/hub-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await updatesHubSettingsService.getSettings();
    return res.json({ success: true, data: updatesHubSettingsService.toPublic(settings) });
  } catch (error) {
    logger.error('[updates] hub-settings get:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to load hub settings',
    });
  }
});

router.put('/admin/hub-settings', requireAdmin, async (req, res) => {
  try {
    const saved = await updatesHubSettingsService.saveSettings(
      req.body || {},
      req.session?.userId || null
    );
    return res.json({ success: true, data: updatesHubSettingsService.toPublic(saved) });
  } catch (error) {
    logger.error('[updates] hub-settings save:', error.message);
    return res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to save hub settings',
    });
  }
});

router.post('/admin/register', requireAdmin, async (req, res) => {
  try {
    const {
      version,
      minFrom,
      changelog,
      packFilename,
      packSha256,
      publish,
      giteaAssetUrl,
    } = req.body || {};
    if (!version || !packFilename) {
      return res.status(400).json({ success: false, error: 'version and packFilename required' });
    }
    const full = path.join(updatesService.PACK_DIR, packFilename);
    let size = null;
    if (fs.existsSync(full)) {
      size = fs.statSync(full).size;
    }
    const row = await updatesService.registerRelease({
      version,
      minFrom,
      changelog,
      packFilename,
      packSha256,
      packSizeBytes: size,
      publish: Boolean(publish),
      giteaAssetUrl,
    });
    const hubSettings = await updatesHubSettingsService.getSettings();
    return res.json({ success: true, data: row, stubMode: hubSettings.stub_mode });
  } catch (error) {
    logger.error('[updates] register:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/packs', requireAdmin, async (req, res) => {
  try {
    const packs = await updatesService.listLocalPacks();
    const hubSettings = await updatesHubSettingsService.getSettings();
    return res.json({
      success: true,
      data: {
        packs,
        packDir: updatesService.PACK_DIR,
        stubMode: hubSettings.stub_mode,
      },
    });
  } catch (error) {
    logger.error('[updates] list packs:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/packs/:filename', requireAdmin, async (req, res) => {
  try {
    const file = await updatesService.resolveLocalPackFile(req.params.filename);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return fs.createReadStream(file.filePath).pipe(res);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
