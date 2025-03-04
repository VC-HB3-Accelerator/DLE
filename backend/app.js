const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { verifySignature, findOrCreateUser } = require('./utils/auth');
const pgSession = require('connect-pg-simple')(session);
const { requireRole } = require('./middleware/auth');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { router: authRouter } = require('./routes/auth');
const { pool } = require('./db');
const FileStore = require('session-file-store')(session);
const helmet = require('helmet');
const sessionMiddleware = require('./middleware/session');
const chatRouter = require('./routes/chat');
const usersRoutes = require('./routes/users');
const contractsRoutes = require('./routes/contracts');
const rolesRoutes = require('./routes/roles');

const app = express();

// Функция для генерации nonce
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// Парсинг JSON - должен быть до всех роутов
app.use(express.json());

// Настройка CORS
app.use(
  cors({
    origin: function(origin, callback) {
      // Разрешаем запросы с любого источника в режиме разработки
      const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:5173', 'http://localhost:5173'];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Nonce'],
  })
);

// Настройка сессий
app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'sessions',
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    name: 'dapp.sid',
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  })
);

// Middleware для безопасности
app.use(
  helmet({
    contentSecurityPolicy: false, // Отключаем CSP для разработки
  })
);

// Middleware для логирования
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body,
    session: req.session,
  });
  next();
});

// Middleware для сохранения сессии после каждого запроса
app.use((req, res, next) => {
  const originalEnd = res.end;

  res.end = function () {
    if (req.session && req.session.save) {
      req.session.save((err) => {
        if (err) {
          console.error('Ошибка при сохранении сессии:', err);
        }
        originalEnd.apply(res, arguments);
      });
    } else {
      originalEnd.apply(res, arguments);
    }
  };

  next();
});

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
  console.log('Auth check:', {
    session: req.session,
    authenticated: req.session.authenticated,
    address: req.session.address,
  });

  if (!req.session.authenticated || !req.session.address) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Миддлвар для обновления дополнительных полей в таблице sessions
app.use(async (req, res, next) => {
  try {
    // Если есть адрес, но нет userId, найдем или создадим пользователя
    if (req.session && req.session.authenticated && req.session.address && !req.session.userId) {
      try {
        const user = await findOrCreateUser(req.session.address, 'wallet');
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.isAdmin = user.is_admin;
        
        // Стандартизируем данные сессии
        standardizeSessionData(req);
        
        // Сохраняем обновленную сессию
        await new Promise((resolve, reject) => {
          req.session.save(err => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch (err) {
        console.error('Ошибка при обновлении userId в сессии:', err);
      }
    }
    
    // Обновляем поля в таблице sessions
    if (req.session && (req.session.userId || req.session.address)) {
      db.query(
        'UPDATE sessions SET last_activity = NOW(), user_id = $1, auth_channel = $2, language = $3 WHERE sid = $4',
        [
          req.session.userId || null,
          req.session.authChannel || 'web',
          req.session.language || 'en',
          req.sessionID
        ]
      ).catch(err => console.error('Error updating session data:', err));
    }
  } catch (err) {
    console.error('Ошибка в middleware сессий:', err);
  }
  
  next();
});

// Функция для стандартизации данных сессии
function standardizeSessionData(req) {
  if (req.session.authenticated) {
    // Убедимся, что все необходимые поля присутствуют
    req.session.authType = req.session.authType || 'wallet';
    req.session.role = req.session.role || 'USER';
    req.session.isAdmin = !!req.session.isAdmin;
    req.session.authChannel = req.session.authChannel || 'web';
    req.session.language = req.session.language || 'en';
  }
}

// API роуты
const apiRouter = express.Router();

// Удалите или закомментируйте этот блок кода
/*
apiRouter.post('/refresh-session', async (req, res) => {
  try {
    const { address, signature } = req.body;
    
    if (!address || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Проверяем подпись
    const verified = await verifySignature(
      { address }, // упрощенное сообщение для проверки
      signature,
      address
    );

    if (!verified) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Обновляем сессию
    req.session.authenticated = true;
    req.session.address = address;
    req.session.lastSignature = signature;

    // Сохраняем сессию
    req.session.save((err) => {
      if (err) {
        console.error('Session refresh error:', err);
        return res.status(500).json({ error: 'Session refresh failed' });
      }

      console.log('Session refreshed:', {
        id: req.sessionID,
        address: address,
        authenticated: true
      });

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Session refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
*/

apiRouter.get('/session', (req, res) => {
  console.log('Session check:', {
    session: req.session,
    authenticated: req.session.authenticated,
    address: req.session.address,
  });

  res.json({
    authenticated: !!req.session.authenticated,
    address: req.session.address || null,
  });
});

// Обновим роут для выхода
apiRouter.post('/signout', (req, res) => {
  try {
    req.session.destroy();
    res.clearCookie('connect.sid'); // Теперь это правильное имя cookie
    res.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Проверка прав администратора
apiRouter.get('/admin/check', async (req, res) => {
  try {
    if (!req.session || !req.session.address) {
      return res.json({ isAdmin: false });
    }

    // Проверяем является ли адрес владельцем контракта
    const ethers = require('ethers');
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
    const contractABI = require('./artifacts/contracts/MyContract.sol/MyContract.json').abi;
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractABI, provider);

    const contractOwner = await contract.owner();
    const isAdmin = req.session.address.toLowerCase() === contractOwner.toLowerCase();

    res.json({ isAdmin });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Только для админов
apiRouter.post('/api/admin/action', requireRole('ADMIN'), (req, res) => {
  // ...
});

// Для модераторов и админов
apiRouter.post('/api/moderate/action', requireRole('MODERATOR'), (req, res) => {
  // ...
});

// Для всех с токеном
apiRouter.post('/api/protected/action', requireRole(), (req, res) => {
  // ...
});

// Обновим роут для верификации
apiRouter.post('/verify', async (req, res) => {
  try {
    console.log('Получен запрос на верификацию в app.js:', req.body);
    const { message, signature } = req.body;

    if (!message || !signature) {
      console.error('Отсутствуют необходимые поля:', {
        message: !!message,
        signature: !!signature,
      });
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Проверяем, что message содержит адрес
    if (!message.address) {
      console.error('Отсутствует адрес в сообщении');
      return res.status(400).json({ success: false, error: 'Missing address in message' });
    }

    // Получаем адрес из сообщения напрямую
    const address = message.address;
    console.log('Адрес из сообщения:', address);

    // Устанавливаем сессию без проверки подписи
    req.session.authenticated = true;
    req.session.address = address;
    req.session.lastSignature = signature;

    // Сохраняем сессию
    req.session.save((err) => {
      if (err) {
        console.error('Ошибка при сохранении сессии:', err);
        return res.status(500).json({
          success: false,
          error: 'Session save failed',
          message: err.message,
        });
      }

      console.log('Сессия сохранена успешно:', req.sessionID);
      return res.json({ success: true, address, isAdmin: true });
    });
  } catch (error) {
    console.error('Подробная ошибка при верификации:', error.stack);
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
      message: error.message || 'Unknown error',
    });
  }
});

// Монтируем API роуты
app.use('/api', apiRouter);

// Подключаем маршруты аутентификации
app.use('/api/auth', authRouter);
app.use('/api/users', usersRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/chat', chatRouter);
app.use('/api/roles', rolesRoutes);

apiRouter.get('/nonce', (req, res) => {
  const nonce = generateNonce();
  console.log('Generated new nonce:', nonce);

  // Сохраняем nonce в сессии
  if (!req.session.nonces) {
    req.session.nonces = [];
  }
  req.session.nonces.push(nonce);

  // Ограничиваем количество nonce в сессии
  if (req.session.nonces.length > 5) {
    req.session.nonces.shift();
  }

  console.log('Nonces in session:', req.session.nonces);

  res.json({ nonce });
});

// Добавьте после настройки сессий
app.use(sessionMiddleware);

// Обработка ошибок сессий
app.use((err, req, res, next) => {
  if (err.code === 'ENOENT' && err.message.includes('sessions')) {
    console.error('Session error:', err);
    // Пересоздаем сессию
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error('Failed to regenerate session:', regenerateErr);
        return res.status(500).json({ error: 'Session error' });
      }
      next();
    });
  } else {
    next(err);
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Подключаем маршруты для отладки
const debugRouter = require('./routes/debug');
app.use('/api/debug', debugRouter);

module.exports = { app };
