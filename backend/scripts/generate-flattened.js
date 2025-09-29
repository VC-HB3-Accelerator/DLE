/**
 * Автоматическая генерация flattened контракта для верификации
 * Создает DLE_flattened.sol из DLE.sol с помощью hardhat flatten
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Пути к файлам
const contractsDir = path.join(__dirname, '../contracts');
const dleContractPath = path.join(contractsDir, 'DLE.sol');
const flattenedPath = path.join(contractsDir, 'DLE_flattened.sol');

// Функция для генерации flattened контракта
function generateFlattened() {
  return new Promise((resolve, reject) => {
    console.log('🔨 Генерация flattened контракта...');
    
    // Проверяем существование исходного контракта
    if (!fs.existsSync(dleContractPath)) {
      reject(new Error(`Исходный контракт не найден: ${dleContractPath}`));
      return;
    }
    
    // Запускаем hardhat flatten с перенаправлением в файл
    try {
      console.log('🔨 Выполняем hardhat flatten...');
      execSync(`npx hardhat flatten contracts/DLE.sol > "${flattenedPath}"`, {
        cwd: path.join(__dirname, '..'),
        shell: true
      });
      
      // Проверяем, что файл создался
      if (fs.existsSync(flattenedPath)) {
        const stats = fs.statSync(flattenedPath);
        console.log('✅ Flattened контракт создан:', flattenedPath);
        console.log(`📊 Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
        resolve();
      } else {
        reject(new Error('Файл не был создан'));
      }
    } catch (error) {
      console.error('❌ Ошибка выполнения hardhat flatten:', error.message);
      reject(new Error(`Ошибка flatten: ${error.message}`));
    }
  });
}

// Функция для проверки актуальности
function checkFlattenedFreshness() {
  if (!fs.existsSync(flattenedPath)) {
    return false;
  }
  
  if (!fs.existsSync(dleContractPath)) {
    return false;
  }
  
  const flattenedStats = fs.statSync(flattenedPath);
  const contractStats = fs.statSync(dleContractPath);
  
  // Flattened файл старше контракта
  return flattenedStats.mtime >= contractStats.mtime;
}

// Основная функция
async function main() {
  try {
    console.log('🔍 Проверка актуальности flattened контракта...');
    
    const isFresh = checkFlattenedFreshness();
    
    if (isFresh) {
      console.log('✅ Flattened контракт актуален');
      return;
    }
    
    console.log('🔄 Flattened контракт устарел, генерируем новый...');
    await generateFlattened();
    
  } catch (error) {
    console.error('❌ Ошибка генерации flattened контракта:', error.message);
    process.exit(1);
  }
}

// Запуск если вызван напрямую
if (require.main === module) {
  main();
}

module.exports = { generateFlattened, checkFlattenedFreshness };
