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
const path = require('path');
const fs = require('fs');
const router = express.Router();


/**
 * @route   GET /api/russian-classifiers/oktmo
 * @desc    Получить список кодов ОКТМО (муниципальные образования)
 * @access  Public
 */
router.get('/oktmo', async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '../db/data/oktmo.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл с кодами ОКТМО не найден'
      });
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const oktmoData = JSON.parse(data);
    
    res.json({
      success: true,
      data: oktmoData.oktmo_codes || [],
      count: oktmoData.oktmo_codes ? oktmoData.oktmo_codes.length : 0
    });
    
  } catch (error) {
    console.error('Ошибка при получении кодов ОКТМО:', error);
    next(error);
  }
});

/**
 * @route   GET /api/russian-classifiers/okved
 * @desc    Получить список кодов ОКВЭД (виды экономической деятельности)
 * @access  Public
 */
router.get('/okved', async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '../db/data/okved.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл с кодами ОКВЭД не найден'
      });
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const okvedData = JSON.parse(data);
    
    // Для ОКВЭД можем добавить фильтрацию по запросу
    const { search, level } = req.query;
    let codes = okvedData.okved_codes || [];
    
    // Фильтрация по поисковому запросу
    if (search) {
      const searchTerm = search.toLowerCase();
      codes = codes.filter(code => 
        code.code.toLowerCase().includes(searchTerm) ||
        code.title.toLowerCase().includes(searchTerm)
      );
    }
    
    // Фильтрация по уровню (количество точек в коде)
    if (level) {
      const targetLevel = parseInt(level);
      codes = codes.filter(code => {
        const codeLevel = (code.code.match(/\./g) || []).length + 1;
        return codeLevel === targetLevel;
      });
    }
    
    // Сортировка кодов ОКВЭД по коду (правильная числовая сортировка для каждой части)
    codes.sort((a, b) => {
      // Разбиваем коды на части для правильной сортировки
      const partsA = a.code.split('.').map(p => parseInt(p, 10));
      const partsB = b.code.split('.').map(p => parseInt(p, 10));
      
      // Сравниваем части по порядку численно
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] !== undefined ? partsA[i] : 0;
        const partB = partsB[i] !== undefined ? partsB[i] : 0;
        
        if (partA !== partB) {
          return partA - partB;
        }
      }
      return 0;
    });
    
    // Ограничиваем количество результатов для производительности
    const limit = parseInt(req.query.limit) || 2000; // Увеличили лимит для полного списка
    codes = codes.slice(0, limit);
    
    res.json({
      success: true,
      data: codes,
      count: codes.length,
      total: okvedData.okved_codes ? okvedData.okved_codes.length : 0
    });
    
  } catch (error) {
    console.error('Ошибка при получении кодов ОКВЭД:', error);
    next(error);
  }
});

/**
 * @route   GET /api/russian-classifiers/okved/:code
 * @desc    Получить информацию о коде ОКВЭД
 * @access  Public
 */
router.get('/okved/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const filePath = path.join(__dirname, '../db/data/okved.json');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл с кодами ОКВЭД не найден'
      });
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const okvedData = JSON.parse(data);
    
    const okvedCode = okvedData.okved_codes.find(c => c.code === code);
    
    if (!okvedCode) {
      return res.status(404).json({
        success: false,
        message: `Код ОКВЭД ${code} не найден`
      });
    }
    
    res.json({
      success: true,
      data: okvedCode
    });
    
  } catch (error) {
    console.error('Ошибка при получении информации о коде ОКВЭД:', error);
    next(error);
  }
});

/**
 * @route   GET /api/russian-classifiers/all
 * @desc    Получить все российские классификаторы одним запросом
 * @access  Public
 */
router.get('/all', async (req, res, next) => {
  try {
    const oktmoPath = path.join(__dirname, '../db/data/oktmo.json');
    const okvedPath = path.join(__dirname, '../db/data/okved.json');
    
    const result = {};
    
    // ОКТМО
    if (fs.existsSync(oktmoPath)) {
      const oktmoData = JSON.parse(fs.readFileSync(oktmoPath, 'utf8'));
      result.oktmo = oktmoData.oktmo_codes || [];
    }
    
    // ОКВЭД (полный список)
    if (fs.existsSync(okvedPath)) {
      const okvedData = JSON.parse(fs.readFileSync(okvedPath, 'utf8'));
      // Отдаем ВСЕ коды ОКВЭД - пользователь хочет полный список
      result.okved = okvedData.okved_codes || [];
    }
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Ошибка при получении всех российских классификаторов:', error);
    next(error);
  }
});

module.exports = router; 