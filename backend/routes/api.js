const express = require('express');
const router = express.Router();
const { ChatOllama } = require('@langchain/ollama');
const { PGVectorStore } = require('@langchain/community/vectorstores/pgvector');
const { OllamaEmbeddings } = require('@langchain/ollama');
const { RunnableSequence } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { Pool } = require('pg');
const { ethers } = require('ethers');
const contractABI = require('../artifacts/contracts/MyContract.sol/MyContract.json').abi;
const crypto = require('crypto');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const chat = new ChatOllama({
  model: 'mistral',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  format: 'json'
});

const embeddings = new OllamaEmbeddings({
  model: 'mistral',
  baseUrl: 'http://localhost:11434',
  requestOptions: {
    headers: {
      'Content-Type': 'application/json'
    }
  },
  dimensions: 4096,
  stripNewLines: true,
  maxConcurrency: 1,
  maxRetries: 3,
  timeout: 10000
});

let vectorStore;
let contract;

async function initVectorStore() {
  try {
    console.log('Начинаем инициализацию векторного хранилища...');
    vectorStore = await PGVectorStore.initialize(
      embeddings,
      {
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
      }
    );
    console.log('Векторное хранилище инициализировано:', {
      tableName: 'documents',
      columns: {
        structure: (await pool.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = 'documents'
          ORDER BY ordinal_position
        `)).rows.map(row => ({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable,
          default: row.column_default
        }))
      },
      config: {
        tableName: vectorStore.tableName,
        columns: vectorStore.columns,
        client: vectorStore.client ? 'Connected' : 'Not connected',
        embeddings: vectorStore.embeddings ? 'Initialized' : 'Not initialized'
      }
    });
  } catch (error) {
    console.error('Ошибка инициализации векторного хранилища:', error);
    throw error;
  }
}

async function initContract() {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
    // Проверяем подключение к сети
    const network = await provider.getNetwork();
    console.log('Подключены к сети:', network.chainId);

    contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      contractABI,
      provider
    );

    // Проверяем что контракт существует
    const code = await provider.getCode(process.env.CONTRACT_ADDRESS);
    if (code === '0x') {
      throw new Error('Contract not deployed at this address');
    }

    // Проверяем подключение
    const owner = await contract.owner();
    console.log('Владелец контракта:', owner);
    console.log('Контракт инициализирован:', process.env.CONTRACT_ADDRESS);
  } catch (error) {
    console.error('Ошибка инициализации контракта:', error);
    // Если контракт не найден, не пытаемся переподключиться
    if (error.message.includes('not deployed')) {
      console.error('Контракт не найден по указанному адресу');
      return;
    }
    // Пробуем переподключиться через 5 секунд
    setTimeout(initContract, 5000);
  }
}

// Инициализируем при старте
initVectorStore().catch(console.error);
initContract().catch(console.error);

// Проверяем подключение к БД при старте
pool.connect((err, client, release) => {
  if (err) {
    console.error('Ошибка подключения к PostgreSQL:', err);
  } else {
    console.log('Успешное подключение к PostgreSQL');
    release();
  }
});

// Middleware для проверки аутентификации
function requireAuth(req, res, next) {
  if (!req.session?.siwe?.address) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Генерация случайного nonce
function generateNonce() {
  return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
}

// Получение nonce для подписи
router.get('/nonce', (req, res) => {
  try {
    setCorsHeaders(res);
    const nonce = generateNonce();
    console.log('Сгенерирован новый nonce:', nonce);
    res.json({ nonce });
  } catch (error) {
    console.error('Ошибка генерации nonce:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Верификация подписи
router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;
    
    // Обновляем данные сессии
    Object.assign(req.session, {
      authenticated: true,
      siwe: message,
      userAddress: message.address,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    });
    
    // Ждем сохранения
    await new Promise((resolve) => {
      req.session.save(resolve);
    });

    console.log('Session saved:', {
      id: req.sessionID,
      authenticated: req.session.authenticated,
      address: req.session.userAddress
    });

    // Проверяем права админа сразу после входа
    const contractOwner = await contract.owner();
    const isAdmin = message.address.toLowerCase() === contractOwner.toLowerCase();
    
    console.log('Проверка прав после входа:', {
      userAddress: message.address,
      contractOwner,
      isAdmin
    });

    res.json({ 
      ok: true,
      isAdmin
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Создаем шаблон промпта для RAG
const TEMPLATE = `Вы - ассистент в DApp приложении. Используйте следующий контекст для ответа:

Контекст: {context}
Вопрос пользователя: {question}

Отвечайте кратко и по существу, основываясь на предоставленном контексте. Если контекст пустой или не релевантный,
используйте свои базовые знания о DApp и блокчейне.`;

const prompt = PromptTemplate.fromTemplate(TEMPLATE);

// Создаем RAG цепочку
const chain = RunnableSequence.from([
  {
    context: async (input) => {
      try {
        const results = await vectorStore.similaritySearch(
          input.question,
          1,
          { type: 'approved_chat' }
        );
        if (!results.length) return '';
        return results
          .filter(doc => doc.pageContent)
          .map(doc => doc.pageContent)
          .join('\n\n');
      } catch (error) {
        console.error('Ошибка поиска контекста:', error);
        return '';
      }
    },
    question: (input) => input.message
  },
  prompt,
  chat,
  new StringOutputParser()
]);

// Функция проверки работоспособности эмбеддингов
async function checkEmbeddings() {
  try {
    const testEmbed = await embeddings.embedQuery('test');
    console.log('Эмбеддинги работают, размерность:', testEmbed.length);
    if (testEmbed.length !== 4096) {
      throw new Error(`Неверная размерность: ${testEmbed.length}, ожидалось: 4096`);
    }
    return true;
  } catch (error) {
    console.error('Ошибка эмбеддингов:', error);
    return false;
  }
}

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const userAddress = req.session.siwe.address;

    // Получаем или создаем пользователя
    let userResult = await pool.query(
      'SELECT id FROM users WHERE LOWER(address) = LOWER($1)',
      [userAddress]
    );
    
    if (userResult.rows.length === 0) {
      userResult = await pool.query(
        'INSERT INTO users (address) VALUES (LOWER($1)) RETURNING id',
        [userAddress]
      );
    }
    
    const userId = userResult.rows[0].id;

    // Создаем входные данные для chain
    const input = {
      message: message,
      question: message
    };

    // Проверяем эмбеддинги перед использованием
    if (!await checkEmbeddings()) {
      console.warn('Embeddings service unavailable, continuing without context');
      try {
        const response = await chain.invoke(input);
        
        // Сохраняем в базу без контекста
        await pool.query(
          'INSERT INTO chat_history (user_id, message, response) VALUES ($1, $2, $3)',
          [userId, message, response]
        );
        
        return res.json({ response });
      } catch (error) {
        console.error('Ошибка генерации ответа:', error);
        throw error;
      }
    }

    const response = await chain.invoke(input);

    // Сохраняем в базу с обработкой ошибок
    try {
      // Получаем похожие документы
      const similarDocs = await vectorStore.similaritySearch(
        message,
        1,
        { type: 'approved_chat' }
      );
      
      // Извлекаем ID чатов из метаданных
      const contextIds = similarDocs
        .map(doc => doc.metadata?.chatId)
        .filter(id => typeof id === 'number');

      await pool.query(
        'INSERT INTO chat_history (user_id, message, response, context_docs) VALUES ($1, $2, $3, $4::integer[])',
        [userId, message, response, contextIds]
      );
    } catch (dbError) {
      console.error('Ошибка сохранения в БД:', dbError);
      // Продолжаем выполнение даже при ошибке сохранения
    }

    res.json({ response });
  } catch (error) {
    console.error('Ошибка чата:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.stack
    });
  }
});

// Получение истории чата
router.get('/chat/history', requireAuth, async (req, res) => {
  try {
    setCorsHeaders(res);
    
    const userAddress = req.session.siwe.address;
    
    // Получаем историю чата пользователя
    const result = await pool.query(
      `SELECT ch.* 
      FROM chat_history ch
      JOIN users u ON ch.user_id = u.id
      WHERE LOWER(u.address) = LOWER($1)
      ORDER BY ch.created_at DESC`,
      [userAddress]
    );
    
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получение списка пользователей
router.get('/users', requireAuth, async (req, res) => {
  try {
    console.log('Запрос списка пользователей');
    const users = await pool.query(
      'SELECT id, LOWER(address) as address, created_at FROM users ORDER BY created_at DESC'
    );
    console.log('Найдено пользователей:', users.rows);
    res.json({ users: users.rows });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка на админа
router.get('/admin/check', requireAuth, async (req, res) => {
  try {
    if (!contract) {
      await initContract();
      if (!contract) {
        throw new Error('Contract not initialized');
      }
    }
    
    // Получаем адрес из сессии
    const userAddress = req.session.siwe.address;
    console.log('Проверка админа, адрес из сессии:', userAddress);
    
    const contractOwner = await contract.owner();
    console.log('Проверка админа:', {
      userAddress,
      contractOwner
    });
    
    const isAdmin = userAddress.toLowerCase() === contractOwner.toLowerCase();
    console.log('Результат проверки админа:', isAdmin);
    
    res.json({ isAdmin });
  } catch (error) {
    console.error('Ошибка проверки админа:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      code: error.code
    });
  }
});

// Общая функция для установки CORS заголовков
function setCorsHeaders(res) {
  res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

// Получение всех чатов для админа
router.get('/admin/chats', requireAdmin, async (req, res) => {
  try {
    setCorsHeaders(res);

    const chats = await pool.query(`
      SELECT 
        ch.id,
        LOWER(u.address) as address,
        ch.message,
        ch.response,
        ch.created_at,
        ch.context_docs,
        EXISTS (
          SELECT 1 FROM documents d 
          WHERE d.metadata->>'chatId' = ch.id::text 
          AND d.metadata->>'type' = 'approved_chat'
        ) as is_approved
      FROM chat_history ch
      JOIN users u ON ch.user_id = u.id
      ORDER BY ch.created_at DESC
    `);

    console.log('Получено чатов:', chats.rows.length);
    if (chats.rows.length > 0) {
      console.log('Пример чата:', {
        id: chats.rows[0].id,
        address: chats.rows[0].address,
        is_approved: chats.rows[0].is_approved
      });
    }

    res.json({ chats: chats.rows });
  } catch (error) {
    console.error('Ошибка получения чатов:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
});

// Одобрение чата для обучения
router.post('/admin/approve', requireAuth, async (req, res) => {
  try {
    const userAddress = req.session.siwe.address;
    const contractOwner = await contract.owner();
    
    if (userAddress.toLowerCase() !== contractOwner.toLowerCase()) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { chatId } = req.body;
    
    // Обновляем статус в базе
    await pool.query(
      'UPDATE chat_history SET is_approved = true WHERE id = $1',
      [chatId]
    );

    // Добавляем в векторное хранилище для обучения
    const chat = await pool.query(
      `SELECT message, response FROM chat_history WHERE id = $1`,
      [chatId]
    );

    if (chat.rows.length > 0) {
      const { message, response } = chat.rows[0];
      console.log('Добавляем в векторное хранилище:', {
        message: message.substring(0, 50) + '...',
        response: response.substring(0, 50) + '...',
        chatId
      });

      const document = {
        pageContent: `Q: ${message}\nA: ${response}`,
        metadata: {
          type: 'approved_chat',
          approvedBy: userAddress,
          chatId: chatId
        }
      };

      // Проверяем работу эмбеддингов
      try {
        const testEmbedding = await embeddings.embedQuery('test');
        console.log('Эмбеддинги работают, размерность:', testEmbedding.length);
      } catch (error) {
        console.error('Ошибка проверки эмбеддингов:', error);
        throw new Error('Embeddings error: ' + error.message);
      }

      console.log('Документ для добавления:', {
        pageContent: document.pageContent.substring(0, 100) + '...',
        metadata: document.metadata,
        vectorStore: {
          tableName: vectorStore.tableName,
          columns: vectorStore.columns
        }
      });

      // Проверяем существование таблицы и её структуру
      const tableInfo = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'documents'
        );
      `);
      console.log('Таблица documents существует:', tableInfo.rows[0].exists);

      if (tableInfo.rows[0].exists) {
        const columns = await pool.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'documents'
          ORDER BY ordinal_position;
        `);
        console.log('Структура таблицы documents:', 
          columns.rows.map(row => `${row.column_name} (${row.data_type})`)
        );
      }

      await vectorStore.addDocuments([
        document
      ]);

      // Проверяем, что документ добавлен
      const added = await vectorStore.similaritySearch(
        document.pageContent,
        1,
        { chatId: chatId }
      );
      console.log('Проверка добавления документа:', {
        found: added.length > 0,
        document: added[0]?.pageContent.substring(0, 100) + '...'
      });

      console.log('Успешно добавлено в векторное хранилище');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка одобрения:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      code: error.code
    });
  }
});

// Улучшаем проверку авторизации админа
async function requireAdmin(req, res, next) {
  if (!req.session?.siwe?.address) {
    return res.status(401).json({ 
      error: 'Not authenticated',
      details: 'Please sign in first'
    });
  }
  
  try {
    // Получаем адреса
    const userAddress = req.session.siwe.address;
    const contractOwner = await contract.owner();
    
    console.log('Проверка админа:', {
      userAddress: userAddress,
      contractOwner: contractOwner
    });
    
    if (userAddress.toLowerCase() !== contractOwner.toLowerCase()) {
      return res.status(403).json({
        error: 'Not authorized',
        details: 'Only contract owner can access this endpoint'
      });
    }
    
    next();
  } catch (error) {
    console.error('Ошибка проверки админа:', error);
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}

// Получение векторного хранилища для админа
router.get('/admin/vectors', requireAdmin, async (req, res) => {
  try {
    setCorsHeaders(res);

    // Добавляем колонку created_at если её нет
    await pool.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('Проверена/добавлена колонка created_at');

    // Проверяем структуру таблицы
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'documents'
    `);
    console.log('Структура таблицы documents:', tableInfo.rows);

    // Получаем все документы из векторного хранилища
    const documents = await pool.query(`
      SELECT 
        d.id,
        d.content,
        d.metadata,
        length(d.embedding::text) as embedding_size,
        COALESCE(d.created_at, CURRENT_TIMESTAMP) as created_at,
        CASE 
          WHEN d.metadata->>'type' = 'approved_chat' THEN true
          ELSE false
        END as is_approved
      FROM documents d
      ORDER BY d.created_at DESC NULLS LAST
    `);

    // Форматируем ответ
    const vectors = documents.rows.map(doc => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
      embedding_size: doc.embedding ? 4096 : 0, // Фиксированный размер для mistral
      created: doc.created_at,
      is_approved: doc.is_approved
    }));

    console.log('Получено векторов:', vectors.length);
    console.log('Пример вектора:', vectors[0]);
    res.json({ vectors });
  } catch (error) {
    console.error('Ошибка получения векторов:', error);
    console.error('Детали ошибки:', {
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      position: error.position
    });
    res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      code: error.code
    });
  }
});

// Обработка CORS preflight запросов для админских роутов
router.options('/admin/*', (req, res) => {
  setCorsHeaders(res);
  res.sendStatus(200);
});

// Очистка кэша и данных
router.post('/admin/clear-cache', requireAdmin, async (req, res) => {
  try {
    setCorsHeaders(res);

    // Очищаем таблицы
    await pool.query('TRUNCATE TABLE documents CASCADE');
    await pool.query('TRUNCATE TABLE chat_history CASCADE');
    await pool.query('TRUNCATE TABLE users CASCADE');

    // Сбрасываем автоинкремент
    await pool.query('ALTER SEQUENCE documents_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE chat_history_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE users_id_seq RESTART WITH 1');

    // Реинициализируем векторное хранилище
    await initVectorStore();

    console.log('Кэш и данные очищены');
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка очистки кэша:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
});

// Выход из системы
router.post('/signout', requireAuth, async (req, res) => {
  try {
    setCorsHeaders(res);
    
    // Уничтожаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error('Ошибка при удалении сессии:', err);
        return res.status(500).json({ error: 'Failed to destroy session' });
      }
      
      console.log('Сессия успешно завершена');
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Ошибка выхода:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Проверка сессии
router.get('/session', (req, res) => {
  try {
    setCorsHeaders(res);
    
    if (req.session?.authenticated && req.session?.siwe?.address) {
      res.json({
        authenticated: true,
        address: req.session.siwe.address
      });
    } else {
      res.json({
        authenticated: false
      });
    }
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создание нового пользователя
router.post('/users', async (req, res) => {
  try {
    setCorsHeaders(res);
    
    const { address } = req.body;
    
    // Проверяем существование пользователя
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE address = $1',
      [address.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      return res.json({ user: existingUser.rows[0] });
    }
    
    // Создаем нового пользователя
    const result = await pool.query(
      'INSERT INTO users (address) VALUES ($1) RETURNING *',
      [address.toLowerCase()]
    );
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Создание необходимых таблиц при старте
async function initializeTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        address VARCHAR(42) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        message TEXT,
        response TEXT,
        is_user BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Таблицы успешно инициализированы');
  } catch (error) {
    console.error('Ошибка инициализации таблиц:', error);
  }
}

// Вызываем инициализацию при старте
initializeTables();

module.exports = router; 