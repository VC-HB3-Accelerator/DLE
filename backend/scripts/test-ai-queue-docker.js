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

// Устанавливаем переменные окружения для Docker
process.env.OLLAMA_BASE_URL = 'http://ollama:11434';
process.env.OLLAMA_MODEL = 'qwen2.5:7b';

const aiQueueService = require('../services/ai-queue');

async function testQueueInDocker() {
  console.log('🐳 Тестирование AI очереди в Docker...\n');

  try {
    // Проверяем инициализацию
    console.log('1. Проверка инициализации очереди...');
    const stats = aiQueueService.getStats();
    console.log('✅ Очередь инициализирована:', stats.isInitialized);
    console.log('📊 Статистика:', {
      totalProcessed: stats.totalProcessed,
      totalFailed: stats.totalFailed,
      currentQueueSize: stats.currentQueueSize,
      runningTasks: stats.runningTasks
    });

    // Тестируем добавление задач
    console.log('\n2. Тестирование добавления задач...');
    
    const testTasks = [
      {
        message: 'Привет, как дела?',
        language: 'ru',
        type: 'chat',
        userId: 1,
        userRole: 'user',
        requestId: 'docker_test_1'
      },
      {
        message: 'Расскажи о погоде',
        language: 'ru',
        type: 'analysis',
        userId: 1,
        userRole: 'user',
        requestId: 'docker_test_2'
      },
      {
        message: 'Срочный вопрос!',
        language: 'ru',
        type: 'urgent',
        userId: 1,
        userRole: 'admin',
        requestId: 'docker_test_3'
      }
    ];

    for (let i = 0; i < testTasks.length; i++) {
      const task = testTasks[i];
      console.log(`   Добавляем задачу ${i + 1}: "${task.message}"`);
      
      try {
        const result = await aiQueueService.addTask(task);
        console.log(`   ✅ Задача добавлена, ID: ${result.taskId}`);
      } catch (error) {
        console.log(`   ❌ Ошибка добавления задачи: ${error.message}`);
      }
    }

    // Ждем обработки
    console.log('\n3. Ожидание обработки задач...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Проверяем статистику
    console.log('\n4. Проверка статистики после обработки...');
    const finalStats = aiQueueService.getStats();
    console.log('📊 Финальная статистика:', {
      totalProcessed: finalStats.totalProcessed,
      totalFailed: finalStats.totalFailed,
      currentQueueSize: finalStats.currentQueueSize,
      runningTasks: finalStats.runningTasks,
      averageProcessingTime: Math.round(finalStats.averageProcessingTime)
    });

    // Тестируем управление очередью
    console.log('\n5. Тестирование управления очередью...');
    
    console.log('   Пауза очереди...');
    aiQueueService.pause();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('   Возобновление очереди...');
    aiQueueService.resume();
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n✅ Тестирование завершено!');

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error);
  }
}

// Запуск теста
if (require.main === module) {
  testQueueInDocker().then(() => {
    console.log('\n🏁 Тест завершен');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { testQueueInDocker }; 