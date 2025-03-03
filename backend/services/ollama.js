const { ChatOllama } = require('@langchain/ollama');
const { RetrievalQAChain } = require("langchain/chains");
const { PromptTemplate } = require("@langchain/core/prompts");
const axios = require('axios');

// Создаем шаблон для контекстного запроса
const PROMPT_TEMPLATE = `
Ты - AI-ассистент для бизнеса, специализирующийся на блокчейн-технологиях и Web3.
Используй следующий контекст для ответа на вопрос пользователя.
Если ты не знаешь ответа, просто скажи, что не знаешь, не пытайся придумать ответ.

Контекст: {context}

Вопрос: {query}

Ответ:
`;

// Функция для проверки доступности Ollama
async function checkOllamaAvailability() {
  console.log('Проверка доступности Ollama...');
  
  try {
    // Добавляем таймаут для запроса
    const response = await axios.get('http://localhost:11434/api/tags', {
      timeout: 5000 // 5 секунд таймаут
    });
    
    if (response.status === 200) {
      console.log('Ollama доступен. Доступные модели:');
      if (response.data && response.data.models) {
        response.data.models.forEach(model => {
          console.log(`- ${model.name}`);
        });
      }
      return true;
    }
  } catch (error) {
    console.error('Ollama недоступен:', error.message);
    console.log('Приложение продолжит работу без Ollama');
    return false;
  }
}

// Функция для прямого запроса к Ollama API
async function directOllamaQuery(message, model = 'mistral') {
  try {
    console.log(`Отправка запроса к Ollama (модель: ${model}):`, message);
    
    // Проверяем доступность Ollama перед отправкой запроса
    const isAvailable = await checkOllamaAvailability();
    if (!isAvailable) {
      throw new Error('Сервер Ollama недоступен');
    }
    
    // Создаем экземпляр ChatOllama
    const ollama = new ChatOllama({
      baseUrl: 'http://localhost:11434',
      model: model,
      temperature: 0.7,
    });
    
    console.log('Отправка запроса к Ollama...');
    const result = await ollama.invoke(message);
    console.log('Получен ответ от Ollama');
    
    return result.content;
  } catch (error) {
    console.error('Ошибка при запросе к Ollama:', error);
    throw error;
  }
}

// Функция для создания цепочки Ollama с RAG
async function createOllamaChain(vectorStore) {
  try {
    console.log('Создаем модель Ollama...');
    // Создаем модель Ollama
    const model = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral',
      temperature: 0.2,
      timeout: 60000, // 60 секунд таймаут
    });
    console.log('Модель Ollama создана');

    // Проверяем модель прямым запросом
    try {
      console.log('Тестируем модель прямым запросом...');
      const testResponse = await model.invoke('Тестовый запрос');
      console.log('Тест модели успешен:', testResponse);
    } catch (testError) {
      console.error('Ошибка при тестировании модели:', testError);
      // Продолжаем выполнение, даже если тест не прошел
    }

    console.log('Создаем шаблон запроса...');
    // Создаем шаблон запроса
    const prompt = new PromptTemplate({
      template: PROMPT_TEMPLATE,
      inputVariables: ["context", "query"],
    });
    console.log('Шаблон запроса создан');

    console.log('Получаем retriever из векторного хранилища...');
    const retriever = vectorStore.asRetriever();
    console.log('Retriever получен');
    
    console.log('Создаем цепочку для поиска и ответа...');
    // Создаем цепочку для поиска и ответа
    const chain = RetrievalQAChain.fromLLM(
      model,
      retriever,
      {
        returnSourceDocuments: true,
        prompt: prompt,
        inputKey: "query",
        outputKey: "text",
        verbose: true
      }
    );
    console.log('Цепочка для поиска и ответа создана');

    return chain;
  } catch (error) {
    console.error('Error creating Ollama chain:', error);
    throw error;
  }
}

// Функция для получения модели Ollama
async function getOllamaModel() {
  try {
    // Создаем модель Ollama
    const model = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral',
      temperature: 0.2,
      timeout: 60000, // 60 секунд таймаут
    });

    return model;
  } catch (error) {
    console.error('Error creating Ollama model:', error);
    throw error;
  }
}

module.exports = { getOllamaModel, createOllamaChain, checkOllamaAvailability, directOllamaQuery }; 