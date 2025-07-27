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
const path = require('path');
const fs = require('fs');
const router = express.Router();

/**
 * @route   GET /api/countries
 * @desc    Получить список всех стран
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    // Путь к файлу с данными стран
    const countriesFilePath = path.join(__dirname, '../db/data/countries.json');
    
    // Проверяем существование файла
    if (!fs.existsSync(countriesFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл с данными стран не найден'
      });
    }
    
    // Читаем файл
    const countriesData = fs.readFileSync(countriesFilePath, 'utf8');
    const countries = JSON.parse(countriesData);
    
    // Возвращаем список стран
    res.json({
      success: true,
      data: countries.countries || [],
      count: countries.countries ? countries.countries.length : 0
    });
    
  } catch (error) {
    console.error('Ошибка при получении списка стран:', error);
    next(error);
  }
});

/**
 * @route   GET /api/countries/:code
 * @desc    Получить информацию о стране по коду
 * @access  Public
 */
router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Путь к файлу с данными стран
    const countriesFilePath = path.join(__dirname, '../db/data/countries.json');
    
    // Проверяем существование файла
    if (!fs.existsSync(countriesFilePath)) {
      return res.status(404).json({
        success: false,
        message: 'Файл с данными стран не найден'
      });
    }
    
    // Читаем файл
    const countriesData = fs.readFileSync(countriesFilePath, 'utf8');
    const countries = JSON.parse(countriesData);
    
    // Ищем страну по коду (поддерживаем поиск по code, code3 или numeric)
    const country = countries.countries.find(c => 
      c.code === code.toUpperCase() || 
      c.code3 === code.toUpperCase() || 
      c.numeric === code
    );
    
    if (!country) {
      return res.status(404).json({
        success: false,
        message: `Страна с кодом ${code} не найдена`
      });
    }
    
    res.json({
      success: true,
      data: country
    });
    
  } catch (error) {
    console.error('Ошибка при получении информации о стране:', error);
    next(error);
  }
});

module.exports = router; 