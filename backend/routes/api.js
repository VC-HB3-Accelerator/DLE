const express = require('express');
const router = express.Router();
const { ChatOllama } = require('@langchain/ollama');
const { PGVectorStore } = require('@langchain/community/vectorstores/pgvector');
const { OllamaEmbeddings } = require('@langchain/ollama');
const { RunnableSequence } = require('@langchain/core/runnables');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const chat = new ChatOllama({
  model: 'mistral',
  baseUrl: 'http://localhost:11434'
});

const embeddings = new OllamaEmbeddings({
  model: 'mistral',
  baseUrl: 'http://localhost:11434'
});

let vectorStore;

async function initVectorStore() {
  vectorStore = await PGVectorStore.initialize(
    embeddings,
    {
      postgresConnectionOptions: {
        connectionString: process.env.DATABASE_URL
      },
      tableName: 'documents'
    }
  );
}

// Инициализируем при старте
initVectorStore().catch(console.error);

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

router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;
    
    // ... верификация подписи ...
    
    // Сохраняем в сессию
    req.session.authenticated = true;
    req.session.siwe = message;
    req.session.userAddress = message.address;
    
    // Ждем сохранения
    await new Promise((resolve) => {
      req.session.save(resolve);
    });

    console.log('Session saved:', {
      id: req.sessionID,
      authenticated: req.session.authenticated,
      address: req.session.userAddress
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Создаем шаблон промпта для RAG
const TEMPLATE = `Вы - ассистент в DApp приложении. 
Используйте этот контекст для ответа на вопрос:
{context}

Вопрос: {question}

Ответ должен быть полезным, точным и основанным на предоставленном контексте.`;

const prompt = PromptTemplate.fromTemplate(TEMPLATE);

// Создаем RAG цепочку
const chain = RunnableSequence.from([
  {
    context: async (input) => {
      const results = await vectorStore.similaritySearch(input.question);
      return results.map(doc => doc.content).join('\n\n');
    },
    question: (input) => input.question
  },
  prompt,
  chat,
  new StringOutputParser()
]);

router.post('/chat', requireAuth, async (req, res) => {
  try {
    if (req.session.siwe.address.toLowerCase() !== req.body.userAddress.toLowerCase()) {
      return res.status(401).json({ 
        error: 'Address mismatch' 
      });
    }

    if (!vectorStore) {
      throw new Error('Vector store not initialized');
    }
    const { message, userAddress } = req.body;
    console.log('Session in chat:', req.session);
    console.log('User address:', userAddress);

    // Получаем или создаем пользователя
    let user = await pool.query(
      'INSERT INTO users (address) VALUES ($1) ON CONFLICT (address) DO UPDATE SET address = EXCLUDED.address RETURNING id',
      [userAddress]
    );
    const userId = user.rows[0].id;

    // Получаем релевантные документы для контекста
    const results = await vectorStore.similaritySearch(message);
    console.log('Found documents:', results);
    const contextIds = results.map(doc => doc.id);

    const response = await chain.invoke({
      question: message
    });

    // Сохраняем историю
    await pool.query(
      'INSERT INTO chat_history (user_id, message, response, context_docs) VALUES ($1, $2, $3, $4)',
      [userId, message, response, contextIds]
    );

    res.json({ response: response });
  } catch (error) {
    console.error('Ошибка чата:', error);
    if (error.code === 'unsupported_country_region_territory') {
      return res.status(503).json({ 
        error: 'Сервис временно недоступен в вашем регионе' 
      });
    }
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение истории чата
router.get('/chat/history', requireAuth, async (req, res) => {
  try {
    const userAddress = req.session.siwe.address;
    
    // Получаем ID пользователя
    const userResult = await pool.query(
      'SELECT id FROM users WHERE address = $1',
      [userAddress]
    );
    const userId = userResult.rows[0].id;

    // Получаем историю чата
    const history = await pool.query(
      `SELECT * FROM (
        SELECT 
          message as content,
          created_at,
          'user' as role
        FROM chat_history 
        WHERE user_id = $1
        UNION ALL
        SELECT 
          response as content,
          created_at,
          'assistant' as role
        FROM chat_history 
        WHERE user_id = $1
      ) messages
      ORDER BY created_at ASC`,
      [userId]
    );

    res.json({ 
      history: history.rows 
    });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router; 