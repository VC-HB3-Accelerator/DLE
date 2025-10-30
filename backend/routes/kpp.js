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
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * @swagger
 * tags:
 *   name: KPP
 *   description: API для КПП кодов (Код причины постановки на учет)
 */

/**
 * @swagger
 * /api/kpp/codes:
 *   get:
 *     summary: Получить список КПП кодов
 *     tags: [KPP]
 *     responses:
 *       200:
 *         description: Список КПП кодов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 codes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         example: "773001001"
 *                       title:
 *                         type: string
 *                         example: "По месту нахождения организации"
 *       500:
 *         description: Ошибка сервера
 */
router.get('/codes', (req, res) => {
  try {
    // Путь к файлу с КПП кодами
    const kppFilePath = path.join(__dirname, '../db/data/kpp_codes.json');
    
    // Читаем файл синхронно (для простоты, можно переделать на асинхронный)
    const kppData = fs.readFileSync(kppFilePath, 'utf8');
    const kppJson = JSON.parse(kppData);
    
    // Возвращаем данные в том же формате, что ожидает frontend
    res.json({
      codes: kppJson.kpp_codes || []
    });
    
    logger.info(`[KPP] Returned ${kppJson.kpp_codes?.length || 0} KPP codes`);
  } catch (error) {
    logger.error('Error fetching KPP codes:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: 'Не удалось загрузить КПП коды' 
    });
  }
});

module.exports = router; 