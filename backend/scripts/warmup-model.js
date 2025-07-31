#!/usr/bin/env node

/**
 * Скрипт для разогрева модели Ollama
 * Запускается при старте backend для ускорения первых запросов
 */

const fetch = require('node-fetch');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://ollama:11434';
const MODEL_NAME = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

async function warmupModel() {
  console.log('🔥 Разогрев модели Ollama...');
  
  try {
    // Проверяем доступность Ollama
    const healthResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!healthResponse.ok) {
      throw new Error(`Ollama недоступен: ${healthResponse.status}`);
    }
    
    console.log('✅ Ollama доступен');
    
    // Отправляем простой запрос для разогрева
    const warmupResponse = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
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
          temperature: 0.3,
          num_predict: 50,
          num_ctx: 512,
          num_thread: 8,
          num_gpu: 1,
          num_gqa: 8,
          rope_freq_base: 1000000,
          rope_freq_scale: 0.5,
          repeat_penalty: 1.1,
          top_k: 40,
          top_p: 0.9,
        },
      }),
    });
    
    if (!warmupResponse.ok) {
      throw new Error(`Ошибка разогрева: ${warmupResponse.status}`);
    }
    
    const data = await warmupResponse.json();
    console.log('✅ Модель разогрета успешно');
    console.log(`📝 Ответ модели: ${data.choices?.[0]?.message?.content?.substring(0, 100)}...`);
    
  } catch (error) {
    console.error('❌ Ошибка разогрева модели:', error.message);
    // Не прерываем запуск приложения
  }
}

// Запускаем разогрев с задержкой
setTimeout(warmupModel, 5000);

module.exports = { warmupModel }; 