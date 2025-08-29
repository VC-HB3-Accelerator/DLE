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
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');

/**
 * @route   POST /api/compile-contracts
 * @desc    Компилировать смарт-контракты через Hardhat
 * @access  Private (только для авторизованных пользователей с ролью admin)
 */
router.post('/', auth.requireAuth, auth.requireAdmin, async (req, res) => {
  try {
    console.log('🔨 Запуск компиляции смарт-контрактов...');
    
    const hardhatProcess = spawn('npx', ['hardhat', 'compile'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    hardhatProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`[COMPILE] ${data.toString().trim()}`);
    });

    hardhatProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[COMPILE_ERR] ${data.toString().trim()}`);
    });

    hardhatProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Компиляция завершена успешно');
        res.json({
          success: true,
          message: 'Смарт-контракты скомпилированы успешно',
          data: { stdout, stderr }
        });
      } else {
        console.error('❌ Ошибка компиляции:', stderr);
        res.status(500).json({
          success: false,
          message: 'Ошибка компиляции смарт-контрактов',
          error: stderr
        });
      }
    });

    hardhatProcess.on('error', (error) => {
      console.error('❌ Ошибка запуска компиляции:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка запуска компиляции',
        error: error.message
      });
    });
    
  } catch (error) {
    logger.error('Ошибка компиляции контрактов:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Произошла ошибка при компиляции контрактов'
    });
  }
});

module.exports = router;
