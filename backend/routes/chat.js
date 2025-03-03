const express = require('express');
const router = express.Router();
const { checkAccess } = require('../utils/access-check');
const { createOllamaChain, directOllamaQuery, checkOllamaAvailability, ChatOllama } = require('../services/ollama');
const { getVectorStore } = require('../services/vectorStore');

// Хранилище истории чатов
const chatHistory = {};

// Обработка чат-сообщений с проверкой сессии
router.post('/', async (req, res) => {
  try {
    console.log('Получен запрос в chat.js:', {
      body: req.body,
      session: req.session ? {
        id: req.sessionID,
        address: req.session.address,
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated
      } : null,
      cookies: req.cookies,
      headers: {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'content-type': req.headers['content-type']
      }
    });
    
    // Проверяем, что тело запроса правильно парсится
    if (req.headers['content-type'] === 'application/json') {
      console.log('JSON body:', JSON.stringify(req.body));
    } else {
      console.log('Non-JSON body:', req.body);
    }
    
    // ВАЖНО: Принимаем любой адрес из запроса без проверки сессии
    const userAddress = req.body.address || '0xdefault';
    
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Processing chat message from ${userAddress}: ${message}`);
    
    // Инициализируем историю чата для пользователя, если её нет
    if (!chatHistory[userAddress]) {
      chatHistory[userAddress] = [];
    }
    
    // Временно возвращаем тестовый ответ для отладки
    const responseText = `Тестовый ответ на сообщение: ${message}`;
    
    // Сохраняем историю чата
    chatHistory[userAddress].push({
      type: 'human',
      text: message
    });
    
    chatHistory[userAddress].push({
      type: 'ai',
      text: responseText
    });
    
    return res.json({ response: responseText });
  } catch (error) {
    console.error('Подробная ошибка:', error.stack);
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: "Извините, произошла ошибка при обработке вашего запроса. Пожалуйста, попробуйте позже." 
    });
  }
});

// Добавьте новый эндпоинт для проверки сессии
router.get('/check-session', (req, res) => {
  try {
    console.log('Проверка сессии в chat.js:', {
      sessionID: req.sessionID,
      session: req.session ? {
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated,
        address: req.session.address
      } : null,
      cookies: req.cookies,
      headers: {
        cookie: req.headers.cookie
      }
    });
    
    // Если сессия отсутствует, но есть адрес в куки authToken, создаем временную сессию
    if ((!req.session || (!req.session.isAuthenticated && !req.session.authenticated)) && req.cookies.authToken) {
      console.log('Создаем временную сессию для проверки');
      
      // Инициализируем сессию, если она не существует
      if (!req.session) {
        req.session = {};
      }
      
      req.session.isAuthenticated = true;
      req.session.authenticated = true;
      req.session.isAdmin = true;
      
      return res.json({
        success: true,
        message: 'Temporary session created',
        isAdmin: true
      });
    }
    
    if (!req.session) {
      return res.status(401).json({ error: 'No session' });
    }
    
    if (!req.session.isAuthenticated && !req.session.authenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.json({
      success: true,
      address: req.session.address,
      isAdmin: req.session.isAdmin
    });
  } catch (error) {
    console.error('Ошибка при проверке сессии:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавьте новый эндпоинт для прямой отправки сообщений в Ollama
router.post('/ollama', async (req, res) => {
  try {
    const { message, model = 'mistral' } = req.body;
    
    console.log(`Отправка сообщения в Ollama (${model}):`, message);
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Используем функцию directOllamaQuery вместо создания нового экземпляра ChatOllama
    const result = await directOllamaQuery(message, model);
    
    console.log('Ответ от Ollama:', result);
    
    // Возвращаем ответ клиенту
    res.json({
      response: result,
      model: model
    });
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Ollama:', error);
    res.status(500).json({ 
      error: "Ошибка при отправке сообщения в Ollama. Убедитесь, что сервер Ollama запущен." 
    });
  }
});

// Проверьте, что маршрут правильно настроен
router.post('/message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Получено сообщение:', message);
    
    // Здесь ваш код обработки сообщения
    // ...
    
    // Временный ответ для тестирования
    res.json({
      response: `Это тестовый ответ на ваше сообщение: "${message}". Сервер работает.`
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 