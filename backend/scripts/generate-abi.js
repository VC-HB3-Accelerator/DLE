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

/**
 * Автоматическая генерация ABI для фронтенда
 * Извлекает ABI из скомпилированных артефактов Hardhat
 */

const fs = require('fs');
const path = require('path');

// Пути к артефактам
const artifactsPath = path.join(__dirname, '../artifacts/contracts');
const frontendAbiPath = path.join(__dirname, '../../frontend/src/utils/dle-abi.js');

// Создаем директорию если она не существует
const frontendDir = path.dirname(frontendAbiPath);
if (!fs.existsSync(frontendDir)) {
  fs.mkdirSync(frontendDir, { recursive: true });
  console.log('✅ Создана директория:', frontendDir);
}

// Функция для извлечения ABI из артефакта
function extractABI(contractName) {
  const artifactPath = path.join(artifactsPath, `${contractName}.sol`, `${contractName}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    console.log(`⚠️ Артефакт не найден: ${artifactPath}`);
    return null;
  }
  
  try {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.abi;
  } catch (error) {
    console.error(`❌ Ошибка чтения артефакта ${contractName}:`, error.message);
    return null;
  }
}

// Функция для форматирования ABI в строку
function formatABI(abi) {
  const functions = abi.filter(item => item.type === 'function');
  const events = abi.filter(item => item.type === 'event');
  
  let result = 'export const DLE_ABI = [\n';
  
  // Функции
  functions.forEach(func => {
    const inputs = func.inputs.map(input => {
      // Если имя параметра пустое, используем только тип
      const paramName = input.name ? ` ${input.name}` : '';
      return `${input.type}${paramName}`;
    }).join(', ');
    const outputs = func.outputs.map(output => output.type).join(', ');
    const returns = outputs ? ` returns (${outputs})` : '';

    result += `  "${func.type} ${func.name}(${inputs})${returns}",\n`;
  });
  
  // События
  events.forEach(event => {
    const inputs = event.inputs.map(input => `${input.type} ${input.name}`).join(', ');
    result += `  "event ${event.name}(${inputs})",\n`;
  });
  
  result += '];\n';
  return result;
}

// Функция для генерации полного файла ABI
function generateABIFile() {
  console.log('🔨 Генерация ABI файла...');
  
  // Извлекаем ABI для DLE контракта
  const dleABI = extractABI('DLE');
  
  if (!dleABI) {
    console.error('❌ Не удалось извлечь ABI для DLE контракта');
    return;
  }
  
  // Форматируем ABI
  const formattedABI = formatABI(dleABI);
  
  // Создаем полный файл
  const fileContent = `/**
 * ABI для DLE смарт-контракта
 * АВТОМАТИЧЕСКИ СГЕНЕРИРОВАНО - НЕ РЕДАКТИРОВАТЬ ВРУЧНУЮ
 * Для обновления запустите: node backend/scripts/generate-abi.js
 * 
 * Последнее обновление: ${new Date().toISOString()}
 */

${formattedABI}

// ABI для деактивации (специальные функции) - НЕ СУЩЕСТВУЮТ В КОНТРАКТЕ
export const DLE_DEACTIVATION_ABI = [
  // Эти функции не существуют в контракте DLE
];

// ABI для токенов (базовые функции)
export const TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
];
`;

  // Записываем файл
  try {
    fs.writeFileSync(frontendAbiPath, fileContent, 'utf8');
    console.log('✅ ABI файл успешно сгенерирован:', frontendAbiPath);
    console.log(`📊 Функций: ${dleABI.filter(item => item.type === 'function').length}`);
    console.log(`📊 Событий: ${dleABI.filter(item => item.type === 'event').length}`);
  } catch (error) {
    console.error('❌ Ошибка записи ABI файла:', error.message);
  }
}

// Запуск генерации
if (require.main === module) {
  generateABIFile();
}

module.exports = { generateABIFile, extractABI, formatABI };
