const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { SiweMessage, generateNonce } = require('siwe');
const path = require('path');
const apiRoutes = require('./routes/api.js');
const FileStore = require('session-file-store')(session);
const TelegramBotService = require('./services/telegramBot');
const EmailBotService = require('./services/emailBot');
const { PGVectorStore } = require('@langchain/community/vectorstores/pgvector');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const app = express();

// Флаг для отслеживания состояния сервера
let isShuttingDown = false;

// Глобальные переменные для сервисов
let telegramBot;
let emailBot;
let vectorStore;

// 1. Парсинг JSON
app.use(express.json());

// 2. CORS
app.use(cors({
  origin: [
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-SIWE-Nonce', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Set-Cookie']
}));

// 3. Сессии
app.use(session({
  name: 'siwe-dapp',
  secret: "siwe-dapp-secret",
  resave: true,
  saveUninitialized: false,
  store: new FileStore({
    path: './sessions',
    ttl: 86400,
    retries: 0,
    logFn: function(){},
    reapInterval: 86400,
    reapAsync: true,
    reapSyncCheck: true,
    retryTimeout: 100
  }),
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    domain: '127.0.0.1',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

// Middleware для сохранения сессии
app.use((req, res, next) => {
  const oldEnd = res.end;
  res.end = function (chunk, encoding) {
    if (req.session && req.session.save) {
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
        oldEnd.apply(res, arguments);
      });
    } else {
      oldEnd.apply(res, arguments);
    }
  };
  next();
});

// Генерация nonce
app.get('/nonce', (req, res) => {
  try {
    if (!req.session) {
      throw new Error('No session available');
    }

    req.session.nonce = generateNonce();
    console.log('Сгенерирован новый nonce:', req.session.nonce);
    res.json({ nonce: req.session.nonce });
  } catch (error) {
    console.error('Ошибка генерации nonce:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Функция для проверки формата адреса EIP-55
function isValidEIP55Address(address) {
  return /^0x[0-9A-F]{40}$/.test(address);
}

// Верификация сообщения
app.post('/verify', async (req, res) => {
  try {
    const clientNonce = req.headers['x-siwe-nonce'];
    const { signature, message } = req.body;
    
    console.log('Received message:', message);
    
    if (!req.session) {
      throw new Error('No session available');
    }

    // Создаем и проверяем SIWE сообщение
    let siweMessage;
    try {
      siweMessage = new SiweMessage(message);
      console.log('SIWE message parsed:', siweMessage);
      
      // Проверяем nonce
      if (siweMessage.nonce !== clientNonce) {
        throw new Error('Invalid nonce');
      }
      
      // Проверяем подпись
      const fields = await siweMessage.verify({
        signature: signature,
        domain: siweMessage.domain,
        nonce: clientNonce
      });

      console.log('SIWE validation successful:', fields);
      console.log('Сообщение успешно верифицировано');
      
      // Сохраняем данные в сессии
      req.session.siwe = fields.data;
      req.session.authenticated = true;
      req.session.nonce = null;
      
      // Принудительно сохраняем сессию
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ 
        success: true,
        address: fields.data.address
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
      error: error.message,
      details: error.stack
    });
  }
});

// Получение сессии
app.get('/session', (req, res) => {
  try {
    if (!req.session) {
      return res.status(401).json({ 
        authenticated: false,
        error: 'No session'
      });
    }

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
      signout: 'GET /signout',
      shutdown: 'POST /shutdown'
    }
  });
});

// Эндпоинт для остановки сервера
app.post('/shutdown', (req, res) => {
  res.json({ message: 'Сервер останавливается...' });
  console.log('Получен запрос на остановку сервера');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// 4. API роуты
app.use('/api', apiRoutes);

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
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`SIWE сервер запущен на порту ${PORT}`);
  console.log('Доступные эндпоинты:');
  console.log('  GET  /          - Информация о сервере');
  console.log('  GET  /nonce     - Получить nonce');
  console.log('  POST /verify    - Верифицировать сообщение');
  console.log('  GET  /session   - Получить текущую сессию');
  console.log('  GET  /signout   - Выйти из системы');
  console.log('  POST /shutdown  - Остановить сервер');
});

// Обработка ошибки занятого порта
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Порт ${PORT} занят. Останавливаем предыдущий процесс...`);
    require('child_process').exec(`lsof -i :${PORT} | grep LISTEN | awk '{print $2}' | xargs kill -9`, (err) => {
      if (err) {
        console.error('Ошибка при остановке процесса:', err);
        process.exit(1);
      }
      console.log('Предыдущий процесс остановлен. Перезапускаем сервер...');
      server.listen(PORT);
    });
  }
});

// Функция корректного завершения работы
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Получен сигнал ${signal}, начинаем корректное завершение...`);

  try {
    if (telegramBot) {
      console.log('Останавливаем Telegram бота...');
      await telegramBot.stop();
    }
    if (emailBot) {
      console.log('Останавливаем Email бота...');
      await emailBot.stop();
    }
    console.log('Все сервисы остановлены');
  } catch (error) {
    console.error('Ошибка при остановке сервисов:', error);
  }

  // Даем время на завершение всех процессов
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// Обработчики сигналов
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Для nodemon

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
  gracefulShutdown('unhandledRejection');
});

// Функция для проверки и остановки существующих процессов бота
async function killExistingBotProcesses() {
  try {
    console.log('Проверяем существующие процессы бота...');
    const { stdout } = await execAsync('ps aux | grep "[n]ode.*telegram"');
    
    if (stdout) {
      console.log('Найдены существующие процессы бота, останавливаем...');
      await execAsync('pkill -SIGTERM -f "[n]ode.*telegram"');
      // Ждем немного, чтобы процессы успели завершиться
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    // Ошибка означает, что процессы не найдены - это нормально
    console.log('Активные процессы бота не найдены');
  }
}

// Инициализация векторного хранилища
async function initializeVectorStore() {
  try {
    // Сначала останавливаем существующие процессы
    await killExistingBotProcesses();

    // Даем время на освобождение ресурсов
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Инициализируем embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      configuration: {
        baseURL: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1'
      }
    });

    // Инициализируем векторное хранилище
    vectorStore = await PGVectorStore.initialize(embeddings, {
      postgresConnectionOptions: {
        connectionString: process.env.DATABASE_URL
      },
      tableName: 'documents',
      columns: {
        idColumnName: 'id',
        vectorColumnName: 'embedding',
        contentColumnName: 'content',
        metadataColumnName: 'metadata',
      }
    });

    console.log('Векторное хранилище инициализировано');

    // Инициализируем ботов только после успешной инициализации хранилища
    if (!telegramBot) {
      telegramBot = new TelegramBotService(process.env.TELEGRAM_BOT_TOKEN, vectorStore);
      await telegramBot.initialize().catch(error => {
        if (error.code === 409) {
          console.log('Telegram бот уже запущен в другом процессе');
        } else {
          throw error;
        }
      });
    }
    if (!emailBot) {
      emailBot = new EmailBotService(vectorStore);
    }

    return vectorStore;
  } catch (error) {
    console.error('Ошибка при инициализации:', error);
    throw error;
  }
}

// Запускаем инициализацию
console.log('Начинаем инициализацию векторного хранилища...');
initializeVectorStore().catch(error => {
  console.error('Критическая ошибка при инициализации:', error);
  process.exit(1);
}); 