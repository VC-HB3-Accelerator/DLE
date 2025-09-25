/**
 * Отладочный скрипт для мониторинга файлов в процессе деплоя
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 ОТЛАДОЧНЫЙ МОНИТОР: Отслеживание файлов current-params.json');
console.log('=' .repeat(70));

class FileMonitor {
  constructor() {
    this.watchedFiles = new Map();
    this.isMonitoring = false;
  }

  startMonitoring() {
    console.log('🚀 Запуск мониторинга файлов...');
    this.isMonitoring = true;
    
    const deployDir = path.join(__dirname, './deploy');
    const tempDir = path.join(__dirname, '../temp');
    
    // Мониторим директории
    this.watchDirectory(deployDir, 'deploy');
    this.watchDirectory(tempDir, 'temp');
    
    // Проверяем существующие файлы
    this.checkExistingFiles();
    
    console.log('✅ Мониторинг запущен. Нажмите Ctrl+C для остановки.');
  }

  watchDirectory(dirPath, label) {
    if (!fs.existsSync(dirPath)) {
      console.log(`📁 Директория ${label} не существует: ${dirPath}`);
      return;
    }

    console.log(`📁 Мониторим директорию ${label}: ${dirPath}`);
    
    try {
      const watcher = fs.watch(dirPath, (eventType, filename) => {
        if (filename && filename.includes('current-params')) {
          const filePath = path.join(dirPath, filename);
          const timestamp = new Date().toISOString();
          
          console.log(`\n🔔 ${timestamp} - ${label.toUpperCase()}:`);
          console.log(`   Событие: ${eventType}`);
          console.log(`   Файл: ${filename}`);
          console.log(`   Путь: ${filePath}`);
          
          if (eventType === 'rename' && filename) {
            // Файл создан или удален
            setTimeout(() => {
              const exists = fs.existsSync(filePath);
              console.log(`   Статус: ${exists ? 'СУЩЕСТВУЕТ' : 'УДАЛЕН'}`);
              
              if (exists) {
                try {
                  const stats = fs.statSync(filePath);
                  console.log(`   Размер: ${stats.size} байт`);
                  console.log(`   Изменен: ${stats.mtime}`);
                } catch (statError) {
                  console.log(`   Ошибка получения статистики: ${statError.message}`);
                }
              }
            }, 100);
          }
        }
      });

      this.watchedFiles.set(dirPath, watcher);
      console.log(`✅ Мониторинг ${label} запущен`);
      
    } catch (watchError) {
      console.log(`❌ Ошибка мониторинга ${label}: ${watchError.message}`);
    }
  }

  checkExistingFiles() {
    console.log('\n🔍 Проверка существующих файлов...');
    
    const pathsToCheck = [
      path.join(__dirname, './deploy/current-params.json'),
      path.join(__dirname, '../temp'),
      path.join(__dirname, './deploy')
    ];

    pathsToCheck.forEach(checkPath => {
      try {
        if (fs.existsSync(checkPath)) {
          const stats = fs.statSync(checkPath);
          if (stats.isFile()) {
            console.log(`📄 Файл найден: ${checkPath}`);
            console.log(`   Размер: ${stats.size} байт`);
            console.log(`   Создан: ${stats.birthtime}`);
            console.log(`   Изменен: ${stats.mtime}`);
          } else if (stats.isDirectory()) {
            console.log(`📁 Директория найдена: ${checkPath}`);
            const files = fs.readdirSync(checkPath);
            const currentParamsFiles = files.filter(f => f.includes('current-params'));
            if (currentParamsFiles.length > 0) {
              console.log(`   Файлы current-params: ${currentParamsFiles.join(', ')}`);
            } else {
              console.log(`   Файлы current-params: не найдены`);
            }
          }
        } else {
          console.log(`❌ Не найден: ${checkPath}`);
        }
      } catch (error) {
        console.log(`⚠️ Ошибка проверки ${checkPath}: ${error.message}`);
      }
    });
  }

  stopMonitoring() {
    console.log('\n🛑 Остановка мониторинга...');
    this.isMonitoring = false;
    
    this.watchedFiles.forEach((watcher, path) => {
      try {
        watcher.close();
        console.log(`✅ Мониторинг остановлен: ${path}`);
      } catch (error) {
        console.log(`❌ Ошибка остановки мониторинга ${path}: ${error.message}`);
      }
    });
    
    this.watchedFiles.clear();
    console.log('✅ Мониторинг полностью остановлен');
  }

  // Метод для периодической проверки
  startPeriodicCheck(intervalMs = 5000) {
    console.log(`⏰ Запуск периодической проверки (каждые ${intervalMs}ms)...`);
    
    const checkInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(checkInterval);
        return;
      }
      
      this.performPeriodicCheck();
    }, intervalMs);
    
    return checkInterval;
  }

  performPeriodicCheck() {
    const timestamp = new Date().toISOString();
    console.log(`\n⏰ ${timestamp} - Периодическая проверка:`);
    
    const filesToCheck = [
      path.join(__dirname, './deploy/current-params.json'),
      path.join(__dirname, './deploy'),
      path.join(__dirname, '../temp')
    ];

    filesToCheck.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            console.log(`   📄 ${path.basename(filePath)}: ${stats.size} байт`);
          } else if (stats.isDirectory()) {
            const files = fs.readdirSync(filePath);
            const currentParamsFiles = files.filter(f => f.includes('current-params'));
            console.log(`   📁 ${path.basename(filePath)}: ${files.length} файлов, current-params: ${currentParamsFiles.length}`);
          }
        } else {
          console.log(`   ❌ ${path.basename(filePath)}: не существует`);
        }
      } catch (error) {
        console.log(`   ⚠️ ${path.basename(filePath)}: ошибка ${error.message}`);
      }
    });
  }
}

// Создаем экземпляр монитора
const monitor = new FileMonitor();

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n🛑 Получен сигнал SIGINT...');
  monitor.stopMonitoring();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Получен сигнал SIGTERM...');
  monitor.stopMonitoring();
  process.exit(0);
});

// Запускаем мониторинг
monitor.startMonitoring();
monitor.startPeriodicCheck(3000); // Проверка каждые 3 секунды

console.log('\n💡 Инструкции:');
console.log('   - Запустите этот скрипт в отдельном терминале');
console.log('   - Затем запустите деплой DLE в другом терминале');
console.log('   - Наблюдайте за изменениями файлов в реальном времени');
console.log('   - Нажмите Ctrl+C для остановки мониторинга');
