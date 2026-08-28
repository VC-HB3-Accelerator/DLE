/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const deploymentWebSocketService = require('../services/deploymentWebSocketService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');

/**
 * Деплой модуля DLE
 * @route POST /api/module-deployment/deploy
 */
router.post('/deploy', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  console.log(`[Module Deployment] POST /deploy вызван с body:`, req.body);
  try {
    const { dleAddress, moduleType, params } = req.body;
    
    if (!dleAddress || !moduleType) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и тип модуля обязательны'
      });
    }

    console.log(`[Module Deployment] Деплой модуля ${moduleType} для DLE: ${dleAddress} с данными из БД`);

    const { resolveModuleDeploymentId } = require('../services/bookDeployKeyService');
    let actualDeploymentId;
    try {
      actualDeploymentId = await resolveModuleDeploymentId(dleAddress);
    } catch (idErr) {
      return res.status(idErr.status || 400).json({
        success: false,
        error: idErr.message,
        code: idErr.code,
      });
    }

    console.log(`[Module Deployment] Запускаем скрипт деплоя с deploymentId: ${actualDeploymentId}`);
    
    // Создаем сессию деплоя и уведомляем WebSocket клиентов
    console.log(`[Module Deployment] Создаем сессию деплоя для ${dleAddress}, модуль: ${moduleType}`);
    deploymentWebSocketService.startDeploymentSession(dleAddress, moduleType);
    console.log(`[Module Deployment] Отправляем логи через WebSocket`);
    deploymentWebSocketService.addDeploymentLog(dleAddress, 'info', `Начинаем деплой модуля ${moduleType}`);
    deploymentWebSocketService.addDeploymentLog(dleAddress, 'info', `Запускаем Hardhat скрипт деплоя...`);
    
    // Отправляем сообщение о начале деплоя
    deploymentWebSocketService.broadcastToDLE(dleAddress, {
      type: 'deployment_started',
      dleAddress: dleAddress,
      moduleType: moduleType,
      status: 'starting',
      progress: 0,
      step: 1,
      message: `Начинаем деплой модуля ${moduleType}`
    });
    
    // Отправляем статус начала деплоя
    deploymentWebSocketService.broadcastToDLE(dleAddress, {
      type: 'deployment_status',
      dleAddress: dleAddress,
      moduleType: moduleType,
      status: 'starting',
      progress: 10,
      step: 1,
      message: 'Инициализация деплоя...'
    });
    
    const child = spawn('npx', ['hardhat', 'run', 'scripts/deploy/deploy-modules.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: {
        ...process.env,
        DEPLOYMENT_ID: actualDeploymentId,
        MODULE_TYPE: moduleType,
        DLE_ADDRESS: dleAddress,
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[Deploy Script] ${output.trim()}`);
      
      // Отправляем логи через WebSocket
      deploymentWebSocketService.addDeploymentLog(dleAddress, 'info', output.trim());
      
      // Анализируем логи и обновляем прогресс (Hardhat пишет Compiled/Deploying в разных формах)
      const lower = output.toLowerCase();
      if (
        lower.includes('compiling')
        || lower.includes('compiled')
        || lower.includes('compilation')
        || lower.includes('downloading compiler')
      ) {
        deploymentWebSocketService.updateDeploymentStatus(dleAddress, {
          status: 'compiling',
          progress: 30,
          step: 2,
          message: 'Компиляция контрактов...',
        });
      } else if (
        lower.includes('deploying')
        || lower.includes('deployed')
        || lower.includes('treasury module')
        || lower.includes('contract address')
        || lower.includes('nonce')
      ) {
        deploymentWebSocketService.updateDeploymentStatus(dleAddress, {
          status: 'deploying',
          progress: 55,
          step: 3,
          message: 'Деплой в сетях...',
        });
      } else if (
        lower.includes('verify')
        || lower.includes('verification')
        || lower.includes('verified')
      ) {
        deploymentWebSocketService.updateDeploymentStatus(dleAddress, {
          status: 'verifying',
          progress: 80,
          step: 4,
          message: 'Верификация контрактов...',
        });
      }
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.log(`[Deploy Script Error] ${output.trim()}`);
      
      // Отправляем ошибки через WebSocket
      deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', output.trim());
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[Module Deployment] Модуль ${moduleType} успешно задеплоен`);
        deploymentWebSocketService.addDeploymentLog(dleAddress, 'success', `Модуль ${moduleType} успешно задеплоен`);
        deploymentWebSocketService.updateDeploymentStatus(dleAddress, {
          status: 'completed',
          progress: 100,
          step: 5,
          message: `Модуль ${moduleType} успешно задеплоен`,
        });
        deploymentWebSocketService.finishDeploymentSession(dleAddress, true, `Модуль ${moduleType} успешно задеплоен`);
        res.json({
          success: true,
          status: 'completed',
          message: `Модуль ${moduleType} успешно задеплоен`,
          stdout: stdout,
          stderr: stderr
        });
      } else {
        console.log(`[Module Deployment] Ошибка при деплое модуля ${moduleType}: код ${code}`);
        const errMsg = `Ошибка при деплое модуля ${moduleType}: код ${code}`;
        deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', errMsg);
        if (stderr) deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', stderr.slice(-2000));
        if (stdout) deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', stdout.slice(-2000));
        deploymentWebSocketService.updateDeploymentStatus(dleAddress, {
          status: 'failed',
          step: Math.max(1, 1),
          message: errMsg,
        });
        deploymentWebSocketService.finishDeploymentSession(dleAddress, false, errMsg);
        res.status(500).json({
          success: false,
          error: errMsg,
          stdout: stdout,
          stderr: stderr
        });
      }
    });

    child.on('error', (error) => {
      console.error(`[Module Deployment] Ошибка запуска процесса: ${error.message}`);
      deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', `Ошибка запуска процесса: ${error.message}`);
      deploymentWebSocketService.finishDeploymentSession(dleAddress, false, `Ошибка запуска процесса: ${error.message}`);
      res.status(500).json({
        success: false,
        error: `Ошибка запуска процесса: ${error.message}`
      });
    });

  } catch (error) {
    console.error(`[Module Deployment] Ошибка: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Деплой модуля из базы данных (алиас для /deploy)
 * @route POST /api/module-deployment/deploy-module-from-db
 */
router.post('/deploy-module-from-db', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res) => {
  console.log(`[Module Deployment] POST /deploy-module-from-db вызван с body:`, req.body);
  try {
    const { dleAddress, moduleType } = req.body;
    
    console.log(`[Module Deployment] Деплой модуля ${moduleType} для DLE: ${dleAddress} с данными из БД`);
    
    // Перенаправляем на основной эндпоинт /deploy
    req.url = '/deploy';
    req.method = 'POST';
    
    // Вызываем основной обработчик
    return router.handle(req, res);
    
  } catch (error) {
    console.error(`[Module Deployment] Ошибка при деплое модуля ${moduleType}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Получить статус деплоя модуля
 * @route GET /api/module-deployment/status/:dleAddress/:moduleType
 */
router.get('/status/:dleAddress/:moduleType', async (req, res) => {
  try {
    const { dleAddress, moduleType } = req.params;
    
    console.log(`[Module Deployment] Получение статуса модуля ${moduleType} для DLE: ${dleAddress}`);
    
    // Здесь можно добавить логику для проверки статуса деплоя модуля
    // Например, проверка файлов модулей или статуса в блокчейне
    
    res.json({
      success: true,
      dleAddress,
      moduleType,
      status: 'deployed', // или 'pending', 'failed' и т.д.
      message: `Статус модуля ${moduleType} для DLE ${dleAddress}`
    });
    
  } catch (error) {
    console.error(`[Module Deployment] Ошибка получения статуса: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Получить список модулей для DLE
 * @route GET /api/module-deployment/modules/:dleAddress
 */
router.get('/modules/:dleAddress', async (req, res) => {
  try {
    const { dleAddress } = req.params;
    
    console.log(`[Module Deployment] Получение списка модулей для DLE: ${dleAddress}`);
    
    // Здесь можно добавить логику для получения списка модулей
    // Например, чтение файлов модулей из файловой системы
    
    res.json({
      success: true,
      dleAddress,
      modules: ['treasury', 'timelock', 'reader'], // пример списка модулей
      message: `Список модулей для DLE ${dleAddress}`
    });
    
  } catch (error) {
    console.error(`[Module Deployment] Ошибка получения списка модулей: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;