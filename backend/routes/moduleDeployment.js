/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const express = require('express');
const router = express.Router();

/**
 * Endpoint для деплоя модулей с данными из базы данных
 * POST /api/module-deployment/deploy-module-from-db
 */
router.post('/deploy-module-from-db', async (req, res) => {
  try {
    const { dleAddress, moduleType } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }

    console.log(`[Module Deployment] Деплой модуля ${moduleType} для DLE: ${dleAddress} с данными из БД`);

    // Импортируем DeployParamsService
    const DeployParamsService = require('../services/deployParamsService');
    
    // Загружаем параметры из базы данных
    const deployParamsService = new DeployParamsService();
    const paramsArray = await deployParamsService.getLatestDeployParams(1);
    
    if (!paramsArray || paramsArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Параметры деплоя не найдены в базе данных'
      });
    }
    
    const params = paramsArray[0]; // Берем первый (последний) элемент

    // Проверяем, что модуль поддерживается
    const supportedModules = ['treasury', 'timelock', 'reader', 'hierarchicalVoting'];
    if (!supportedModules.includes(moduleType)) {
      return res.status(400).json({
        success: false,
        error: `Неподдерживаемый тип модуля: ${moduleType}. Поддерживаемые: ${supportedModules.join(', ')}`
      });
    }

    // Устанавливаем переменные окружения из базы данных
    if (params.privateKey || params.private_key) {
      process.env.PRIVATE_KEY = params.privateKey || params.private_key;
    }
    
    if (params.etherscanApiKey || params.etherscan_api_key) {
      process.env.ETHERSCAN_API_KEY = params.etherscanApiKey || params.etherscan_api_key;
    }

    // Запускаем деплой модулей через скрипт
    const { spawn } = require('child_process');
    const path = require('path');
    
    const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-modules.js');
    const deploymentId = params.id || 'latest';
    
    console.log(`[Module Deployment] Запускаем скрипт деплоя с deploymentId: ${deploymentId}`);
    
    const child = spawn('node', [scriptPath, '--deployment-id', deploymentId, '--module-type', moduleType], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[Deploy Script] ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Deploy Script Error] ${data.toString().trim()}`);
    });

    // Отправляем немедленный ответ о запуске деплоя
    res.json({
      success: true,
      message: `Деплой модуля ${moduleType} запущен`,
      deploymentId: deploymentId,
      status: 'started'
    });

    // Обрабатываем завершение деплоя асинхронно
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[Module Deployment] Деплой модуля ${moduleType} успешно завершен`);
        // Здесь можно добавить WebSocket уведомление о завершении
      } else {
        console.error(`[Module Deployment] Ошибка при деплое модуля ${moduleType}: код ${code}`);
        // Здесь можно добавить WebSocket уведомление об ошибке
      }
    });

    child.on('error', (error) => {
      console.error(`[Module Deployment] Ошибка запуска скрипта деплоя:`, error);
      res.status(500).json({
        success: false,
        error: `Ошибка запуска скрипта деплоя: ${error.message}`
      });
    });

  } catch (error) {
    console.error('[Module Deployment] Ошибка при деплое модуля из БД:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при деплое модуля: ' + error.message
    });
  }
});

/**
 * Endpoint для получения статуса деплоя модулей
 * GET /api/module-deployment/deployment-status
 */
router.get('/deployment-status', async (req, res) => {
  try {
    const { dleAddress } = req.query;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    // Здесь можно добавить логику для проверки статуса деплоя
    // Например, проверка файлов результатов деплоя
    
    res.json({
      success: true,
      message: 'Статус деплоя получен',
      dleAddress: dleAddress,
      status: 'completed' // или 'in_progress', 'failed'
    });

  } catch (error) {
    console.error('[Module Deployment] Ошибка получения статуса деплоя:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса деплоя: ' + error.message
    });
  }
});

module.exports = router;
