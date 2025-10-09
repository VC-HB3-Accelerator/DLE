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

const axios = require('axios');
const ollamaConfig = require('../services/ollamaConfig');

const TIMEOUTS = ollamaConfig.getTimeouts();

async function checkOllamaModels() {
  try {
    console.log('Проверка доступных моделей Ollama...');

    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await axios.get(`${baseUrl}/api/tags`, {
      timeout: TIMEOUTS.ollamaTags, // Централизованный таймаут
    });

    if (response.status === 200 && response.data && response.data.models) {
      console.log('\nДоступные модели Ollama:');
      console.log('------------------------');

      response.data.models.forEach((model) => {
        console.log(`- ${model.name}`);
      });

      console.log('\nДля использования конкретной модели, укажите ее в .env файле:');
      console.log('OLLAMA_EMBEDDINGS_MODEL=qwen2.5');
      console.log('OLLAMA_MODEL=qwen2.5');
    } else {
      console.log('Не удалось получить список моделей');
    }
  } catch (error) {
    console.error('Ошибка при проверке моделей Ollama:', error.message);
    console.log('\nУбедитесь, что Ollama запущен. Вы можете запустить его командой:');
    console.log('ollama serve');
  }
}

// Запускаем проверку
checkOllamaModels();
