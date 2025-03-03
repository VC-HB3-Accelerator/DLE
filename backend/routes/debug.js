const express = require('express');
const router = express.Router();

// Эндпоинт для отладки сессий
router.get('/session', (req, res) => {
  try {
    console.log('Отладка сессии:', {
      sessionID: req.sessionID,
      session: req.session ? {
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated,
        address: req.session.address,
        isAdmin: req.session.isAdmin
      } : null,
      cookies: req.cookies,
      headers: {
        cookie: req.headers.cookie
      }
    });
    
    res.json({
      sessionID: req.sessionID,
      session: req.session ? {
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated,
        address: req.session.address,
        isAdmin: req.session.isAdmin
      } : null,
      cookies: req.cookies
    });
  } catch (error) {
    console.error('Ошибка при отладке сессии:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Эндпоинт для создания тестовой сессии
router.post('/create-session', (req, res) => {
  const { address } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address is required' });
  }
  
  // Инициализируем сессию, если она не существует
  if (!req.session) {
    req.session = {};
  }
  
  req.session.isAuthenticated = true;
  req.session.authenticated = true;
  req.session.address = address.toLowerCase();
  req.session.isAdmin = true;
  
  // Сохраняем сессию
  req.session.save((err) => {
    if (err) {
      console.error('Ошибка сохранения тестовой сессии:', err);
      return res.status(500).json({ error: 'Session save error' });
    }
    
    console.log('Тестовая сессия создана:', {
      sessionID: req.sessionID,
      session: {
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated,
        address: req.session.address,
        isAdmin: req.session.isAdmin
      }
    });
    
    res.cookie('authToken', 'true', {
      maxAge: 86400000,
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });
    
    res.json({
      success: true,
      sessionID: req.sessionID,
      address: req.session.address,
      isAdmin: req.session.isAdmin
    });
  });
});

// Тестовый эндпоинт для отправки сообщений без проверки сессии
router.post('/test-chat', (req, res) => {
  try {
    const { message, address } = req.body;
    
    console.log('Тестовый чат-запрос:', {
      message,
      address,
      headers: {
        cookie: req.headers.cookie,
        'content-type': req.headers['content-type']
      },
      cookies: req.cookies,
      session: req.session ? {
        isAuthenticated: req.session.isAuthenticated,
        authenticated: req.session.authenticated,
        address: req.session.address,
        isAdmin: req.session.isAdmin
      } : null
    });
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Возвращаем тестовый ответ
    res.json({
      response: `Тестовый ответ на сообщение: ${message}`,
      receivedAddress: address,
      sessionAddress: req.session?.address
    });
  } catch (error) {
    console.error('Ошибка в тестовом чате:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Тестовый эндпоинт для проверки соединения
router.get('/ping', (req, res) => {
  res.json({ 
    message: 'pong', 
    timestamp: new Date().toISOString(),
    server: {
      port: process.env.PORT || 8080,
      address: req.socket.localAddress,
      hostname: require('os').hostname()
    }
  });
});

// Тестовый эндпоинт для проверки Ollama
router.get('/ollama-test', async (req, res) => {
  try {
    const { directOllamaQuery } = require('../services/ollama');
    
    // Тестовый запрос к Ollama
    const result = await directOllamaQuery('Привет, как дела?', 'mistral');
    
    res.json({
      success: true,
      response: result,
      model: 'mistral'
    });
  } catch (error) {
    console.error('Ошибка при тестировании Ollama:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при тестировании Ollama'
    });
  }
});

// Тестовый эндпоинт для проверки доступности Ollama
router.get('/ollama-status', async (req, res) => {
  try {
    const { checkOllamaAvailability } = require('../services/ollama');
    
    // Проверяем доступность Ollama
    const isAvailable = await checkOllamaAvailability();
    
    if (isAvailable) {
      res.json({
        status: 'ok',
        message: 'Ollama доступен'
      });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Ollama недоступен'
      });
    }
  } catch (error) {
    console.error('Ошибка при проверке доступности Ollama:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Ошибка при проверке доступности Ollama'
    });
  }
});

module.exports = router; 