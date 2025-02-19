import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { SiweMessage, generateNonce } from 'siwe';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    
    if (!signature || !message) {
      console.error('Отсутствует подпись или сообщение');
      throw new Error('Invalid signature or message');
    }

    // Создаем и верифицируем SIWE сообщение
    console.log('Начинаем парсинг SIWE сообщения...');
    const siweMessage = new SiweMessage(message);
    
    console.log('Парсинг успешен:', {
      domain: siweMessage.domain,
      address: siweMessage.address,
      nonce: siweMessage.nonce
    });
    
    const { success, data: fields } = await siweMessage.verify({ 
      signature,
      domain: siweMessage.domain,
      nonce: req.session.nonce
    });
    
    console.log('Результат верификации:', { success, fields });
    
    if (!success) {
      throw new Error('Signature verification failed');
    }
    
    // Сохраняем сессию
    req.session.authenticated = true;
    req.session.siwe = fields;
    
    console.log('Сессия сохранена:', {
      authenticated: true,
      address: fields.address
    });
    
    req.session.save(() => {
      console.log('Session saved successfully');
      res.status(200).json({ 
        success: true,
        address: fields.address
      });
    });
  } catch (error) {
    console.error('Ошибка верификации:', error);
    req.session.authenticated = false;
    req.session.nonce = null;
    req.session.siwe = null;
    res.status(400).json({ 
      error: 'Verification failed',
      message: error.message 
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`SIWE сервер запущен на порту ${PORT}`);
  console.log('Доступные эндпоинты:');
  console.log('  GET  /          - Информация о сервере');
  console.log('  GET  /nonce     - Получить nonce');
  console.log('  POST /verify    - Верифицировать сообщение');
  console.log('  GET  /session   - Получить текущую сессию');
  console.log('  GET  /signout   - Выйти из системы');
}); 