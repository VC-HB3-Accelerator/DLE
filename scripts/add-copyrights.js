#!/usr/bin/env node

/**
 * Скрипт для добавления копирайтов в файлы проекта DLE
 * Автор: Тарабанов Александр Викторович
 * Email: info@hb3-accelerator.com
 */

const fs = require('fs');
const path = require('path');

// Нормализация ссылок/метаданных в уже существующих заголовках
const GITHUB_OLD = 'https://github.com/VC-HB3-Accelerator';
const GITHUB_NEW = 'https://github.com/VC-HB3-Accelerator';

function normalizeHeaderContent(content) {
  let updated = content.replaceAll(GITHUB_OLD, GITHUB_NEW);
  return updated;
}

// Копирайт заголовки для разных типов файлов
const copyrightHeaders = {
  // JavaScript/TypeScript файлы
  js: `/**
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

`,

  // Vue файлы
  vue: `<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

`,

  // CSS/SCSS файлы
  css: `/*
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

`,

  // HTML файлы
  html: `<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

`,

  // Python файлы
  py: `"""
Copyright (c) 2024-2026 Тарабанов Александр Викторович
All rights reserved.

This software is proprietary and confidential.
Unauthorized copying, modification, or distribution is prohibited.

For licensing inquiries: info@hb3-accelerator.com
Website: https://hb3-accelerator.com
GitHub: https://github.com/VC-HB3-Accelerator
"""

`,

  // Solidity файлы
  sol: `// SPDX-License-Identifier: PROPRIETARY
// Copyright (c) 2024-2026 Тарабанов Александр Викторович
// All rights reserved.
//
// This software is proprietary and confidential.
// Unauthorized copying, modification, or distribution is prohibited.
//
// For licensing inquiries: info@hb3-accelerator.com
// Website: https://hb3-accelerator.com
// GitHub: https://github.com/VC-HB3-Accelerator

`,



  // YAML файлы
  yml: `# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# 
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
# 
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/VC-HB3-Accelerator

`,

  // Markdown файлы
  md: `<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

`,

  // Shell скрипты
  sh: `#!/bin/bash
# Copyright (c) 2024-2026 Тарабанов Александр Викторович
# All rights reserved.
# 
# This software is proprietary and confidential.
# Unauthorized copying, modification, or distribution is prohibited.
# 
# For licensing inquiries: info@hb3-accelerator.com
# Website: https://hb3-accelerator.com
# GitHub: https://github.com/VC-HB3-Accelerator

`
};

// Файлы и папки, которые нужно исключить
const excludePatterns = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.github',
  'logs',
  'temp',
  'cache',
  'artifacts',
  'contracts-data',
  'frontend_dist',
  'legal/patents', // Исключаем патентные документы
  '*.lock',
  '*.log',
  '*.tmp',
  '*.cache',
  '*.min.js',
  '*.min.css'
];

// Расширения файлов для обработки
const fileExtensions = [
  'js', 'ts', 'jsx', 'tsx', 'vue', 'css', 'scss', 'html', 'py', 'sol', 
  'yml', 'yaml', 'md', 'sh', 'bash'
];

// Специальные файлы для обработки (без расширения)
const specialFiles = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.local.yml',
  'setup.sh',
  'clean-logs.sh'
];

// Проверка, нужно ли исключить файл
function shouldExclude(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  for (const pattern of excludePatterns) {
    if (pattern.includes('*')) {
      // Паттерн с wildcard
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(relativePath)) {
        return true;
      }
    } else {
      // Обычный паттерн
      if (relativePath.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

// Получение расширения файла
function getFileExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase().substring(1);
  return ext;
}

// Проверка, есть ли уже копирайт в файле
function hasCopyright(content) {
  const copyrightKeywords = [
    'Copyright (c) 2024-2026 Тарабанов Александр Викторович',
    'Copyright (c) 2024-2026 Тарабанов',
    'Тарабанов Александр Викторович'
  ];
  
  return copyrightKeywords.some(keyword => content.includes(keyword));
}

// Добавление копирайта в файл
function addCopyrightToFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем, есть ли уже копирайт
    if (hasCopyright(content)) {
      // Нормализуем ссылки в существующем заголовке (например, GitHub организация)
      const normalized = normalizeHeaderContent(content);
      if (normalized !== content) {
        fs.writeFileSync(filePath, normalized, 'utf8');
        console.log(`🔧 Нормализован копирайт: ${filePath}`);
        return true;
      }
      console.log(`⚠️  Копирайт уже есть (изменений нет): ${filePath}`);
      return false;
    }
    
    const ext = getFileExtension(filePath);
    const header = copyrightHeaders[ext];
    
    if (!header) {
      console.log(`❌ Неизвестное расширение: ${filePath}`);
      return false;
    }
    
    // Добавляем копирайт в начало файла
    const newContent = header + content;
    fs.writeFileSync(filePath, newContent, 'utf8');
    
    console.log(`✅ Добавлен копирайт: ${filePath}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Ошибка при обработке ${filePath}:`, error.message);
    return false;
  }
}

// Рекурсивный обход директорий
function processDirectory(dirPath) {
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!shouldExclude(fullPath)) {
          processDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        if (!shouldExclude(fullPath)) {
          const ext = getFileExtension(fullPath);
          const fileName = path.basename(fullPath);
          
          if (fileExtensions.includes(ext) || specialFiles.includes(fileName)) {
            addCopyrightToFile(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.error(`❌ Ошибка при обработке директории ${dirPath}:`, error.message);
  }
}

// Основная функция
function main() {
  console.log('🚀 Начинаем добавление копирайтов в файлы проекта DLE...\n');
  
  const directories = [
    'frontend/src',
    'backend',
    'scripts',
    'docs'
  ];
  
  let totalProcessed = 0;
  let totalAdded = 0;
  
  for (const dir of directories) {
    if (fs.existsSync(dir)) {
      console.log(`📁 Обрабатываем директорию: ${dir}`);
      processDirectory(dir);
    } else {
      console.log(`⚠️  Директория не найдена: ${dir}`);
    }
  }
  
  console.log('\n✅ Добавление копирайтов завершено!');
  console.log('\n📋 Следующие шаги:');
  console.log('1. Проверьте добавленные копирайты');
  console.log('2. Убедитесь, что все важные файлы обработаны');
  console.log('3. Сделайте коммит изменений');
  console.log('4. Опубликуйте проект на GitHub');
}

// Запуск скрипта
if (require.main === module) {
  main();
}

module.exports = {
  addCopyrightToFile,
  processDirectory,
  shouldExclude,
  hasCopyright
}; 