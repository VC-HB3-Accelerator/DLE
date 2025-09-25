/**
 * Главный скрипт для запуска всех тестов
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 ЗАПУСК ВСЕХ ТЕСТОВ ДЛЯ ВЫЯВЛЕНИЯ ПРОБЛЕМЫ');
console.log('=' .repeat(70));

const tests = [
  {
    name: 'Тест создания файла',
    script: './test-file-creation.js',
    description: 'Проверяет базовое создание и обновление файла current-params.json'
  },
  {
    name: 'Тест полного потока деплоя',
    script: './test-deploy-flow.js',
    description: 'Имитирует полный процесс деплоя DLE с созданием файла'
  },
  {
    name: 'Тест сохранения файла',
    script: './test-file-persistence.js',
    description: 'Проверяет сохранение файла после различных операций'
  },
  {
    name: 'Тест обработки ошибок',
    script: './test-error-handling.js',
    description: 'Проверяет поведение при ошибках деплоя'
  }
];

async function runTest(testInfo, index) {
  return new Promise((resolve, reject) => {
    console.log(`\n${index + 1}️⃣ ${testInfo.name}`);
    console.log(`📝 ${testInfo.description}`);
    console.log('─'.repeat(50));
    
    const testPath = path.join(__dirname, testInfo.script);
    const testProcess = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: __dirname
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${testInfo.name} - УСПЕШНО`);
        resolve(true);
      } else {
        console.log(`❌ ${testInfo.name} - ОШИБКА (код: ${code})`);
        resolve(false);
      }
    });

    testProcess.on('error', (error) => {
      console.log(`❌ ${testInfo.name} - ОШИБКА ЗАПУСКА: ${error.message}`);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('🚀 Запуск всех тестов...\n');
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const result = await runTest(tests[i], i);
    results.push({
      name: tests[i].name,
      success: result
    });
    
    // Небольшая пауза между тестами
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Итоговый отчет
  console.log('\n' + '='.repeat(70));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ ТЕСТОВ');
  console.log('='.repeat(70));
  
  const successfulTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name}`);
  });
  
  console.log(`\n📈 Результаты: ${successfulTests}/${totalTests} тестов прошли успешно`);
  
  if (successfulTests === totalTests) {
    console.log('🎉 ВСЕ ТЕСТЫ ПРОШЛИ УСПЕШНО!');
    console.log('💡 Проблема НЕ в базовых операциях с файлами');
    console.log('🔍 Возможные причины проблемы:');
    console.log('   - Процесс деплоя прерывается до создания файла');
    console.log('   - Ошибка в логике dleV2Service.js');
    console.log('   - Проблема с правами доступа к файлам');
    console.log('   - Конфликт с другими процессами');
  } else {
    console.log('⚠️ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОШЛИ');
    console.log('🔍 Это поможет локализовать проблему');
  }
  
  console.log('\n🛠️ СЛЕДУЮЩИЕ ШАГИ:');
  console.log('1. Запустите: node debug-file-monitor.js (в отдельном терминале)');
  console.log('2. Запустите деплой DLE в другом терминале');
  console.log('3. Наблюдайте за созданием/удалением файлов в реальном времени');
  console.log('4. Проверьте логи Docker: docker logs dapp-backend -f');
  
  console.log('\n📋 ДОПОЛНИТЕЛЬНЫЕ КОМАНДЫ ДЛЯ ОТЛАДКИ:');
  console.log('# Проверить права доступа к директориям:');
  console.log('ls -la backend/scripts/deploy/');
  console.log('ls -la backend/temp/');
  console.log('');
  console.log('# Проверить процессы Node.js:');
  console.log('ps aux | grep node');
  console.log('');
  console.log('# Проверить использование диска:');
  console.log('df -h backend/scripts/deploy/');
}

// Запускаем все тесты
runAllTests().catch(error => {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
  process.exit(1);
});
