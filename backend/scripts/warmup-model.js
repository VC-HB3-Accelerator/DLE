#!/usr/bin/env node

/**
 * Скрипт для разогрева модели Ollama
 * Запускается при старте backend для ускорения первых запросов
 */

const fetch = require('node-fetch');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL_NAME = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function warmupModel() {
  // console.log('🔥 Разогрев модели Ollama...');
  
  try {
    // Проверяем доступность Ollama
    const healthResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!healthResponse.ok) {
      throw new Error(`Ollama недоступен: ${healthResponse.status}`);
    }
    
          // console.log('✅ Ollama доступен');
    
    // Отправляем простой запрос для разогрева (корректный эндпоинт)
    const warmupResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: 'Ты полезный ассистент.' },
          { role: 'user', content: 'Привет! Как дела?' }
        ],
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 64,
          num_ctx: 1024,
          num_thread: 4,
          num_gpu: 1,
          repeat_penalty: 1.1,
          top_k: 30,
          top_p: 0.9
        }
      }),
    });
    
    if (!warmupResponse.ok) {
      throw new Error(`Ошибка разогрева: ${warmupResponse.status}`);
    }
    
    const data = await warmupResponse.json();
          // console.log('✅ Модель разогрета успешно');
      // console.log(`📝 Ответ модели: ${(data.message?.content || data.response || '').substring(0, 100)}...`);
    
  } catch (error) {
          // console.error('❌ Ошибка разогрева модели:', error.message);
    // Не прерываем запуск приложения
  }
}

// Запускаем разогрев с задержкой
setTimeout(warmupModel, 5000);

module.exports = { warmupModel }; 