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
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const deploymentWebSocketService = require('../services/deploymentWebSocketService');

/**
 * Деплой модуля DLE
 * @route POST /api/module-deployment/deploy
 */
router.post('/deploy', async (req, res) => {
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
    
    // Запускаем деплой модулей через скрипт
    const scriptPath = path.join(__dirname, '../scripts/deploy/deploy-modules.js');
    const deploymentId = (params && params.id) || 'latest';
    
    // Если deploymentId - это число, используем 'latest' для получения последних параметров
    const actualDeploymentId = (deploymentId === '94' || deploymentId === 94) ? 'latest' : deploymentId;
    
    console.log(`[Module Deployment] Запускаем скрипт деплоя с deploymentId: ${deploymentId}`);
    
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
        MODULE_TYPE: moduleType
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
      
      // Анализируем логи и обновляем прогресс
      if (output.includes('Compiling') || output.includes('Compilation')) {
        deploymentWebSocketService.broadcastToDLE(dleAddress, {
          type: 'deployment_status',
          dleAddress: dleAddress,
          moduleType: moduleType,
          status: 'compiling',
          progress: 30,
          step: 2,
          message: 'Компиляция контрактов...'
        });
      } else if (output.includes('Deploying') || output.includes('deploying')) {
        deploymentWebSocketService.broadcastToDLE(dleAddress, {
          type: 'deployment_status',
          dleAddress: dleAddress,
          moduleType: moduleType,
          status: 'deploying',
          progress: 50,
          step: 3,
          message: 'Деплой в сетях...'
        });
      } else if (output.includes('verify') || output.includes('verification')) {
        deploymentWebSocketService.broadcastToDLE(dleAddress, {
          type: 'deployment_status',
          dleAddress: dleAddress,
          moduleType: moduleType,
          status: 'verifying',
          progress: 80,
          step: 4,
          message: 'Верификация контрактов...'
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
        deploymentWebSocketService.finishDeploymentSession(dleAddress, true, `Модуль ${moduleType} успешно задеплоен`);
        res.json({
          success: true,
          message: `Модуль ${moduleType} успешно задеплоен`,
          stdout: stdout,
          stderr: stderr
        });
      } else {
        console.log(`[Module Deployment] Ошибка при деплое модуля ${moduleType}: код ${code}`);
        deploymentWebSocketService.addDeploymentLog(dleAddress, 'error', `Ошибка при деплое модуля ${moduleType}: код ${code}`);
        deploymentWebSocketService.finishDeploymentSession(dleAddress, false, `Ошибка при деплое модуля ${moduleType}: код ${code}`);
        res.status(500).json({
          success: false,
          error: `Ошибка при деплое модуля ${moduleType}: код ${code}`,
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
router.post('/deploy-module-from-db', async (req, res) => {
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