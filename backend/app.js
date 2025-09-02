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

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const sessionConfig = require('./config/session');
const logger = require('./utils/logger');
// const csurf = require('csurf'); // Закомментировано, так как не используется
const errorHandler = require('./middleware/errorHandler');
// const { version } = require('./package.json'); // Закомментировано, так как не используется
const db = require('./db'); // Добавляем импорт db
const aiAssistant = require('./services/ai-assistant'); // Добавляем импорт aiAssistant
const { warmupModel } = require('./scripts/warmup-model'); // Добавляем импорт разогрева модели
const fs = require('fs');
const path = require('path');
const messagesRoutes = require('./routes/messages');
const ragRoutes = require('./routes/rag'); // Новый роут для RAG-ассистента
const monitoringRoutes = require('./routes/monitoring');
const pagesRoutes = require('./routes/pages'); // Добавляем импорт роутера страниц
const uploadsRoutes = require('./routes/uploads');
const ensRoutes = require('./routes/ens');
// Factory routes removed - no longer needed

// Проверка и создание директорий для хранения данных контрактов
const ensureDirectoriesExist = () => {
  const directories = [
    path.join(__dirname, 'contracts-data'),
    path.join(__dirname, 'contracts-data/dles'),
    path.join(__dirname, 'temp'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/logos')
  ];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        logger.error(`Ошибка при создании директории ${dir}: ${error.message}`);
      }
    } else {
    }
    
    // Проверка прав на запись
    try {
      const testFile = path.join(dir, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      logger.error(`Директория ${dir} недоступна для записи: ${error.message}`);
    }
  }
};

// Вызываем функцию проверки директорий при запуске сервера
ensureDirectoriesExist();

// Регистрируем коллбек для пересоздания session middleware при смене пула
db.setPoolChangeCallback(sessionConfig.reloadSessionMiddleware);

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const identitiesRoutes = require('./routes/identities');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const tokensRouter = require('./routes/tokens');
const isicRoutes = require('./routes/isic'); // Добавленный импорт
const kppRoutes = require('./routes/kpp'); // Добавленный импорт КПП кодов
const geocodingRoutes = require('./routes/geocoding'); // Добавленный импорт

const dleV2Routes = require('./routes/dleV2'); // Добавляем импорт DLE v2 маршрутов
const settingsRoutes = require('./routes/settings'); // Добавляем импорт маршрутов настроек
const tablesRoutes = require('./routes/tables'); // Добавляем импорт таблиц
const countriesRoutes = require('./routes/countries'); // Добавляем импорт маршрутов стран
const russianClassifiersRoutes = require('./routes/russian-classifiers'); // Добавляем импорт российских классификаторов
const ollamaRoutes = require('./routes/ollama'); // Добавляем импорт Ollama маршрутов
const aiQueueRoutes = require('./routes/ai-queue'); // Добавляем импорт AI Queue маршрутов
const tagsRoutes = require('./routes/tags'); // Добавляем импорт маршрутов тегов
const blockchainRoutes = require('./routes/blockchain'); // Добавляем импорт blockchain маршрутов
const dleCoreRoutes = require('./routes/dleCore'); // Основные функции DLE
const dleProposalsRoutes = require('./routes/dleProposals'); // Функции предложений
const dleModulesRoutes = require('./routes/dleModules'); // Функции модулей
const dleTokensRoutes = require('./routes/dleTokens'); // Функции токенов
const dleAnalyticsRoutes = require('./routes/dleAnalytics'); // Аналитика и история
const compileRoutes = require('./routes/compile'); // Компиляция контрактов
const dleMultichainRoutes = require('./routes/dleMultichain'); // Мультичейн функции
const dleHistoryRoutes = require('./routes/dleHistory'); // Расширенная история
const systemRoutes = require('./routes/system'); // Добавляем импорт маршрутов системного мониторинга

const app = express();

// Указываем хост явно
app.set('host', '0.0.0.0');
app.set('port', process.env.PORT || 8000);

// Настройка CORS
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://hb3-accelerator.com',
      'https://www.hb3-accelerator.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  })
);

// Настройка сессии (используем геттер, чтобы всегда был актуальный middleware)
app.use((req, res, next) => sessionConfig.sessionMiddleware(req, res, next));

// Добавим middleware для проверки сессии
app.use(async (req, res, next) => {
  // console.log('Request cookies:', req.headers.cookie);
  // console.log('Session ID:', req.sessionID);

  // Проверяем сессию в базе данных
  if (req.sessionID) {
    const result = await db.getQuery()('SELECT sess FROM session WHERE sid = $1', [req.sessionID]);
    // console.log('Session from DB:', result.rows[0]?.sess);
  }
  
  next();
});

// Логирование запросов (только для отладки)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    // console.log('[APP] Глобальный лог:', req.method, req.originalUrl); // Убрано
    // logger.info(`${req.method} ${req.url}`); // Убрано
    next();
  });
}

// Middleware для подстановки req.user из сессии
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      isAdmin: req.session.isAdmin,
      address: req.session.address,
    };
  }
  next();
});

// Настройка парсеров
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статическая раздача загруженных файлов (для dev и prod)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Настройка безопасности
app.use(
  helmet({
    contentSecurityPolicy: false, // Отключаем CSP для разработки
  })
);

// Маршруты API
app.use('/api/tables', tablesRoutes); // ДОЛЖНО БЫТЬ ВЫШЕ!
// app.use('/api', identitiesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tokens', tokensRouter);
app.use('/api/isic', isicRoutes); // Добавленное использование роута
app.use('/api/kpp', kppRoutes); // Добавленное использование роута КПП кодов
app.use('/api/geocoding', geocodingRoutes); // Добавленное использование роута

app.use('/api/dle-v2', dleV2Routes); // Добавляем маршрут DLE v2
app.use('/api/settings', settingsRoutes); // Добавляем маршрут настроек
app.use('/api/countries', countriesRoutes); // Добавляем маршрут стран
app.use('/api/russian-classifiers', russianClassifiersRoutes); // Добавляем маршрут российских классификаторов
app.use('/api/ollama', ollamaRoutes); // Добавляем маршрут Ollama
app.use('/api/ai-queue', aiQueueRoutes); // Добавляем маршрут AI Queue
app.use('/api/tags', tagsRoutes); // Добавляем маршрут тегов
app.use('/api/blockchain', blockchainRoutes); // Добавляем маршрут blockchain
app.use('/api/dle-core', dleCoreRoutes); // Основные функции DLE
app.use('/api/dle-proposals', dleProposalsRoutes); // Функции предложений
app.use('/api/dle-modules', dleModulesRoutes); // Функции модулей
app.use('/api/dle-tokens', dleTokensRoutes); // Функции токенов
app.use('/api/dle-analytics', dleAnalyticsRoutes); // Аналитика и история
app.use('/api/dle-multichain', dleMultichainRoutes); // Мультичейн функции
app.use('/api/dle-history', dleHistoryRoutes); // Расширенная история
app.use('/api/messages', messagesRoutes);
app.use('/api/identities', identitiesRoutes);
app.use('/api/rag', ragRoutes); // Подключаем роут
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/pages', pagesRoutes); // Подключаем роутер страниц
app.use('/api/system', systemRoutes); // Добавляем маршрут системного мониторинга
app.use('/api/uploads', uploadsRoutes); // Загрузка файлов (логотипы)
app.use('/api/ens', ensRoutes); // ENS utilities
// app.use('/api/factory', factoryRoutes); // Factory routes removed - no longer needed
app.use('/api/compile-contracts', compileRoutes); // Компиляция контрактов

const nonceStore = new Map(); // или любая другая реализация хранилища nonce

// Значение для маскирования чувствительных данных
const redactedValue = '***********';

// Логируем переменные окружения для отладки
// console.log('NODE_ENV:', process.env.NODE_ENV);
// console.log('PORT:', process.env.PORT);
// console.log('POSTGRES_HOST:', process.env.POSTGRES_HOST);
// console.log('POSTGRES_PORT:', process.env.POSTGRES_PORT);
// console.log('POSTGRES_DB:', process.env.POSTGRES_DB);
// console.log('POSTGRES_USER:', redactedValue);
// console.log('POSTGRES_PASSWORD:', redactedValue);
// console.log('TELEGRAM_BOT_TOKEN:', redactedValue);
// console.log('TELEGRAM_BOT_USERNAME:', process.env.TELEGRAM_BOT_USERNAME);
// console.log('OPENAI_API_KEY:', redactedValue);
// console.log('SESSION_SECRET:', process.env.SESSION_SECRET); // Убираем вывод секретного ключа
// console.log('EMAIL_USER:', process.env.EMAIL_USER);
// console.log('EMAIL_PASSWORD:', redactedValue);

// console.log('typeof errorHandler:', typeof errorHandler, errorHandler.name);

// Добавляем обработчик ошибок последним
app.use(errorHandler);

// Эндпоинт для проверки состояния
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {}
    };

    // Проверяем подключение к БД
    try {
      await db.query('SELECT NOW()');
      healthStatus.services.database = { status: 'ok' };
    } catch (error) {
      healthStatus.services.database = { status: 'error', error: error.message };
      healthStatus.status = 'error';
    }

    // Проверяем AI сервис
    try {
      const aiStatus = await aiAssistant.checkHealth();
      healthStatus.services.ai = aiStatus;
      if (aiStatus.status === 'error') {
        healthStatus.status = 'error';
      }
    } catch (error) {
      healthStatus.services.ai = { status: 'error', error: error.message };
      healthStatus.status = 'error';
    }

    // Проверяем Vector Search сервис
    try {
      const vectorSearchClient = require('./services/vectorSearchClient');
      const vectorStatus = await vectorSearchClient.health();
      healthStatus.services.vectorSearch = vectorStatus;
      if (vectorStatus.status === 'error') {
        healthStatus.status = 'error';
      }
    } catch (error) {
      healthStatus.services.vectorSearch = { status: 'error', error: error.message };
      healthStatus.status = 'error';
    }

    const statusCode = healthStatus.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// Очистка старых сессий
setInterval(
  async () => {
    try {
      await db.getQuery('DELETE FROM session WHERE expire < NOW()');
    } catch (error) {
      // console.error('Error cleaning old sessions:', error);
    }
  },
  15 * 60 * 1000
); // Каждые 15 минут

// Инициализация сервиса настроек БД для динамического обновления подключений
const initializeDbSettingsService = async () => {
  try {
    const dbSettingsService = require('./services/dbSettingsService');
    await dbSettingsService.initialize();
    // logger.info('[App] Сервис настроек БД инициализирован'); // Убрано избыточное логирование
  } catch (error) {
    logger.error('[App] Ошибка инициализации сервиса настроек БД:', error);
  }
};

// Инициализируем сервис настроек БД при запуске
if (process.env.NODE_ENV !== 'migration') {
  initializeDbSettingsService();
}

module.exports = { app, nonceStore };
