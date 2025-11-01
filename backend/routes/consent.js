/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const consentService = require('../services/consentService');
const { DOCUMENT_CONSENT_MAP } = consentService;

// Получить список документов для подписания
router.get('/documents', async (req, res) => {
  try {
    const tableName = 'admin_pages_simple';
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }
    
    // Получаем документы для подписания по названиям
    const documentTitles = Object.keys(DOCUMENT_CONSENT_MAP);
    const { rows } = await db.getQuery()(`
      SELECT id, title, summary, content, created_at, updated_at
      FROM ${tableName} 
      WHERE status = 'published' 
        AND visibility = 'public'
        AND title = ANY($1)
      ORDER BY created_at DESC
    `, [documentTitles]);
    
    // Добавляем тип согласия к каждому документу
    const documents = rows.map(doc => ({
      ...doc,
      consentType: DOCUMENT_CONSENT_MAP[doc.title] || null,
    }));
    
    res.json(documents);
  } catch (error) {
    logger.error('Error fetching consent documents:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Проверить, подписал ли пользователь необходимые документы
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const walletAddress = req.session.address;
    
    if (!userId && !walletAddress) {
      return res.status(400).json({ error: 'Требуется авторизация' });
    }
    
    // Получаем все необходимые типы согласий
    const requiredConsentTypes = Object.values(DOCUMENT_CONSENT_MAP);
    
    // Получаем активные согласия пользователя
    let query = `
      SELECT consent_type, status, signed_at, document_id, document_title
      FROM consent_logs
      WHERE status = 'granted'
        AND (
    `;
    
    const params = [];
    if (userId) {
      query += `user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (walletAddress) {
      if (params.length > 0) query += ' OR ';
      query += `wallet_address = $${params.length + 1}`;
      params.push(walletAddress);
    }
    
    query += `)
      AND consent_type = ANY($${params.length + 1})
      ORDER BY signed_at DESC
    `;
    params.push(requiredConsentTypes);
    
    const { rows } = await db.getQuery()(query, params);
    
    // Формируем статус для каждого типа согласия
    const status = {};
    requiredConsentTypes.forEach(type => {
      const consent = rows.find(r => r.consent_type === type);
      status[type] = consent ? {
        granted: true,
        signedAt: consent.signed_at,
        documentId: consent.document_id,
        documentTitle: consent.document_title,
      } : {
        granted: false,
      };
    });
    
    // Проверяем, все ли согласия предоставлены
    const allGranted = requiredConsentTypes.every(type => status[type].granted);
    
    res.json({
      allGranted,
      status,
    });
  } catch (error) {
    logger.error('Error checking consent status:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Сохранить согласие пользователя
router.post('/grant', async (req, res) => {
  try {
    // Разрешаем подпись как для авторизованных, так и для гостей
    const userId = req.session?.userId || null;
    const walletAddress = req.session?.address || null;
    const guestId = req.session?.guestId || null;
    const { documentIds, consentTypes } = req.body; // Массивы ID документов и типов согласий
    
    // Если нет ни userId, ни walletAddress, используем guestId для идентификации
    if (!userId && !walletAddress && !guestId) {
      return res.status(400).json({ error: 'Требуется идентификация (авторизация или гостевая сессия)' });
    }
    
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'Требуется указать документы для подписания' });
    }
    
    // Получаем информацию о документах
    const { rows: documents } = await db.getQuery()(`
      SELECT id, title
      FROM admin_pages_simple
      WHERE id = ANY($1) AND status = 'published'
    `, [documentIds]);
    
    if (documents.length !== documentIds.length) {
      return res.status(400).json({ error: 'Некоторые документы не найдены' });
    }
    
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');
    
    // Сохраняем согласия для каждого документа
    const results = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const consentType = consentTypes && consentTypes[i] 
        ? consentTypes[i] 
        : DOCUMENT_CONSENT_MAP[doc.title];
      
      if (!consentType) {
        logger.warn(`Unknown consent type for document: ${doc.title}`);
        continue;
      }
      
      // Проверяем, есть ли уже активное согласие
      let checkQuery = `
        SELECT id FROM consent_logs
        WHERE status = 'granted' AND consent_type = $1 AND (
      `;
      const checkParams = [consentType];
      if (userId) {
        checkQuery += `user_id = $${checkParams.length + 1}`;
        checkParams.push(userId);
      }
      if (walletAddress) {
        if (checkParams.length > 1) checkQuery += ' OR ';
        checkQuery += `wallet_address = $${checkParams.length + 1}`;
        checkParams.push(walletAddress);
      }
      // Для гостей проверяем по формату guest_${guestId}
      if (guestId && !walletAddress) {
        if (checkParams.length > 1) checkQuery += ' OR ';
        checkQuery += `wallet_address = $${checkParams.length + 1}`;
        checkParams.push(`guest_${guestId}`);
      }
      checkQuery += ')';
      
      const existing = await db.getQuery()(checkQuery, checkParams);
      
      if (existing.rows.length > 0) {
        // Обновляем существующее согласие
        await db.getQuery()(`
          UPDATE consent_logs
          SET document_id = $1,
              document_title = $2,
              signed_at = NOW(),
              revoked_at = NULL,
              ip_address = $3,
              user_agent = $4,
              updated_at = NOW()
          WHERE id = $5
        `, [doc.id, doc.title, ipAddress, userAgent, existing.rows[0].id]);
        
        results.push({ documentId: doc.id, consentType, action: 'updated' });
      } else {
        // Для гостей используем guestId как wallet_address для последующей миграции
        const consentWalletAddress = walletAddress || (guestId ? `guest_${guestId}` : null);
        
        // Создаем новое согласие
        await db.getQuery()(`
          INSERT INTO consent_logs (
            user_id, wallet_address, document_id, document_title,
            consent_type, status, ip_address, user_agent, channel
          ) VALUES ($1, $2, $3, $4, $5, 'granted', $6, $7, 'web')
        `, [userId, consentWalletAddress, doc.id, doc.title, consentType, ipAddress, userAgent]);
        
        results.push({ documentId: doc.id, consentType, action: 'created' });
      }
    }
    
    logger.info(`Consent granted: userId=${userId}, walletAddress=${walletAddress}, documents=${documentIds.join(',')}`);
    
    res.json({
      success: true,
      results,
    });
  } catch (error) {
    logger.error('Error granting consent:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Отозвать согласие
router.post('/revoke', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const walletAddress = req.session.address;
    const { consentTypes } = req.body; // Массив типов согласий для отзыва
    
    if (!userId && !walletAddress) {
      return res.status(400).json({ error: 'Требуется авторизация' });
    }
    
    if (!consentTypes || !Array.isArray(consentTypes) || consentTypes.length === 0) {
      return res.status(400).json({ error: 'Требуется указать типы согласий для отзыва' });
    }
    
    let query = `
      UPDATE consent_logs
      SET status = 'revoked',
          revoked_at = NOW(),
          updated_at = NOW()
      WHERE consent_type = ANY($1) AND status = 'granted' AND (
    `;
    
    const params = [consentTypes];
    if (userId) {
      query += `user_id = $${params.length + 1}`;
      params.push(userId);
    }
    if (walletAddress) {
      if (params.length > 1) query += ' OR ';
      query += `wallet_address = $${params.length + 1}`;
      params.push(walletAddress);
    }
    query += ')';
    
    const { rowCount } = await db.getQuery()(query, params);
    
    logger.info(`Consent revoked: userId=${userId}, walletAddress=${walletAddress}, types=${consentTypes.join(',')}`);
    
    res.json({
      success: true,
      revokedCount: rowCount,
    });
  } catch (error) {
    logger.error('Error revoking consent:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;

