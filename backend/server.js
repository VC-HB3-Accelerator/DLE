const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { SiweMessage, generateNonce } = require('siwe');
const path = require('path');

const app = express();

// Конфигурация CORS для работы с frontend
app.use(cors({
  origin: ['http://localhost:5174', 'http://127.0.0.1:5173', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка сессий
app.use(session({
  name: 'siwe-dapp',
  secret: "siwe-dapp-secret",
  resave: true,
  saveUninitialized: true,
  cookie: { 
    secure: false, 
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 часа
  }
}));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Генерация nonce
app.get('/nonce', (req, res) => {
  try {
    req.session.nonce = generateNonce();
    console.log('Сгенерирован новый nonce:', req.session.nonce);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ nonce: req.session.nonce });
  } catch (error) {
    console.error('Ошибка генерации nonce:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Верификация сообщения
app.post('/verify', async (req, res) => {
  try {
    const { signature, message } = req.body;
    
    console.log('Получен запрос на верификацию:', {
      signature: signature?.slice(0, 20) + '...',
      message,
      sessionNonce: req.session.nonce
    });
    
    if (!req.session.nonce) {
      console.error('Сессия не содержит nonce');
      throw new Error('Invalid session');
    }
    
    let siweMessage;
    try {
      siweMessage = new SiweMessage(message);
      const fields = await siweMessage.validate(signature);
      
      if (fields.nonce !== req.session.nonce) {
        console.error('Nonce не совпадает');
        throw new Error('Invalid nonce');
      }
      
      console.log('Сообщение успешно верифицировано');
      req.session.siwe = fields;
      req.session.authenticated = true;
      req.session.nonce = null;
      
      res.json({ 
        success: true,
        address: fields.address 
      });
    } catch (error) {
      console.error('Ошибка валидации сообщения:', error);
      req.session.authenticated = false;
      req.session.siwe = null;
      req.session.nonce = null;
      throw error;
    }
  } catch (error) {
    console.error('Ошибка верификации:', error);
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Получение сессии
app.get('/session', (req, res) => {
  try {
    res.json({
      authenticated: !!req.session.authenticated,
      address: req.session.siwe?.address
    });
  } catch (error) {
    console.error('Ошибка получения сессии:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Выход
app.get('/signout', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Ошибка при удалении сессии:', err);
        return res.status(500).json({ error: 'Failed to destroy session' });
      }
      res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Базовый маршрут
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: {
      nonce: 'GET /nonce',
      verify: 'POST /verify',
      session: 'GET /session',
      signout: 'GET /signout'
    }
  });
});

// Обработка 404
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.url} не существует`
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SIWE сервер запущен на порту ${PORT}`);
  console.log('Доступные эндпоинты:');
  console.log('  GET  /          - Информация о сервере');
  console.log('  GET  /nonce     - Получить nonce');
  console.log('  POST /verify    - Верифицировать сообщение');
  console.log('  GET  /session   - Получить текущую сессию');
  console.log('  GET  /signout   - Выйти из системы');
}); 