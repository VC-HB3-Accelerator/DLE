const express = require('express');
const router = express.Router();
const { ChatOllama } = require('@langchain/ollama');
const { getVectorStore } = require('../services/vectorStore');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { saveGuestMessageToDatabase } = require('../db');

// Добавьте эту функцию в начало файла chat.js
async function getAIResponse(message, language = 'ru') {
  // Определяем язык сообщения, если не указан явно
  let detectedLanguage = language;
  if (!language || language === 'auto') {
    // Простая эвристика для определения языка
    const cyrillicPattern = /[а-яА-ЯёЁ]/;
    detectedLanguage = cyrillicPattern.test(message) ? 'ru' : 'en';
  }

  // Формируем системный промпт в зависимости от языка
  let systemPrompt = '';
  if (detectedLanguage === 'ru') {
    systemPrompt = 'Вы - полезный ассистент. Отвечайте на русском языке.';
  } else {
    systemPrompt = 'You are a helpful assistant. Respond in English.';
  }

  // Создаем экземпляр ChatOllama
  const chat = new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'mistral',
    system: systemPrompt
  });

  console.log('Отправка запроса к Ollama...');
  
  // Получаем ответ от модели
  try {
    const response = await chat.invoke(message);
    return response.content;
  } catch (error) {
    console.error('Ошибка при вызове ChatOllama:', error);
    
    // Альтернативный метод запроса через прямой API
    try {
      console.log('Пробуем альтернативный метод запроса...');
      const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'mistral',
          prompt: message,
          system: systemPrompt,
          stream: false
        }),
      });
      
      const data = await response.json();
      return data.response;
    } catch (fallbackError) {
      console.error('Ошибка при использовании альтернативного метода:', fallbackError);
      return "Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.";
    }
  }
}

// Функция для обработки гостевых сообщений после аутентификации
async function processGuestMessages(userId, guestId) {
  try {
    console.log(`Starting to process guest messages for user ${userId} with guestId ${guestId}`);

    // Получаем все гостевые сообщения
    const guestMessages = await db.query(
      `SELECT m.id, m.content, m.conversation_id, m.metadata, m.created_at
       FROM messages m
       WHERE m.metadata->>'guest_id' = $1
       ORDER BY m.created_at ASC`,
      [guestId]
    );

    console.log(`Found ${guestMessages.rows.length} guest messages to process`);

    // Обновляем user_id для всех бесед с гостевыми сообщениями
    await db.query(
      `UPDATE conversations c
       SET user_id = $1
       WHERE id IN (
         SELECT DISTINCT conversation_id
         FROM messages m
         WHERE m.metadata->>'guest_id' = $2
       )`,
      [userId, guestId]
    );

    // Обрабатываем каждое гостевое сообщение
    for (const msg of guestMessages.rows) {
      console.log(`Processing guest message ${msg.id}: ${msg.content}`);
      
      // Получаем язык из метаданных
      const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      const language = metadata?.language || 'ru';

      // Получаем ответ от AI
      console.log(`Getting AI response for message ${msg.id} in ${language}`);
      const aiResponse = await getAIResponse(msg.content, language);

      // Сохраняем ответ AI в ту же беседу
      await db.query(
        `INSERT INTO messages 
         (conversation_id, sender_type, content, channel, created_at)
         VALUES ($1, 'assistant', $2, 'chat', NOW())`,
        [msg.conversation_id, aiResponse]
      );

      console.log(`Saved AI response for message ${msg.id}`);
    }

    console.log(`Successfully processed all guest messages for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error processing guest messages:', error);
    return false;
  }
}

// Обработчик для гостевых сообщений
router.post('/guest-message', async (req, res) => {
  const { message, language } = req.body;

  // Генерируем временный ID сессии, если его нет
  if (!req.session.guestId) {
    req.session.guestId = crypto.randomBytes(16).toString('hex');
  }

  try {
    // Создаем запись в conversations для гостя
    const conversationResult = await db.query(
      `INSERT INTO conversations (created_at)
       VALUES (NOW())
       RETURNING id`
    );
    
    const conversationId = conversationResult.rows[0].id;

    // Создаем метаданные
    const metadata = {
      guest_id: req.session.guestId,
      language: language || 'en'
    };

    // Сохраняем только сообщение пользователя
    await db.query(
      `INSERT INTO messages 
       (conversation_id, sender_type, content, channel, metadata, created_at)
       VALUES ($1, 'guest', $2, 'chat', $3, NOW())`,
      [
        conversationId,
        message,
        JSON.stringify(metadata)
      ]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для обычных сообщений (для аутентифицированных пользователей)
router.post('/message', requireAuth, async (req, res) => {
  const { message, language } = req.body;
  const userId = req.session.userId;

  try {
    // Создаем новую беседу или получаем существующую
    const conversationResult = await db.query(
      `INSERT INTO conversations (user_id, created_at)
       VALUES ($1, NOW())
       RETURNING id`,
      [userId]
    );
    
    const conversationId = conversationResult.rows[0].id;

    // Сохраняем сообщение пользователя
    await db.query(
      `INSERT INTO messages 
       (conversation_id, sender_type, content, channel, created_at)
       VALUES ($1, 'user', $2, 'chat', NOW())`,
      [conversationId, message]
    );

    // Получаем ответ от AI
    const aiResponse = await getAIResponse(message, language);

    // Сохраняем ответ AI
    await db.query(
      `INSERT INTO messages 
       (conversation_id, sender_type, content, channel, created_at)
       VALUES ($1, 'assistant', $2, 'chat', NOW())`,
      [conversationId, aiResponse]
    );

    res.json({
      success: true,
      message: aiResponse
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавьте этот маршрут для проверки доступных моделей
router.get('/models', async (req, res) => {
  try {
    const ollama = new Ollama();
    const models = await ollama.list();

    res.json({
      success: true,
      models: models.models.map((model) => model.name),
    });
  } catch (error) {
    console.error('Ошибка при получении списка моделей:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Получение истории сообщений
router.get('/history', async (req, res) => {
  const limit = parseInt(req.query.limit) || 2; // По умолчанию только последнее сообщение и ответ
  const offset = parseInt(req.query.offset) || 0;

  try {
    if (!req.session.authenticated || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем общее количество сообщений
    const countResult = await db.query(
      `SELECT COUNT(*) as total
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 
       OR (m.metadata->>'guest_id' = $2 AND m.metadata->>'processed' = 'true')`,
      [req.session.userId, req.session.guestId]
    );

    const total = parseInt(countResult.rows[0].total);

    // Получаем сообщения с пагинацией
    const result = await db.query(
      `SELECT m.id, m.content, m.sender_type as role, m.created_at, 
              c.user_id, m.metadata
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = $1 
       OR (m.metadata->>'guest_id' = $2 AND m.metadata->>'processed' = 'true')
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.session.userId, req.session.guestId, limit, offset]
    );

    return res.json({
      success: true,
      messages: result.rows.reverse(),
      total
    });

  } catch (error) {
    console.error('Error getting chat history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для получения всех диалогов (только для админов)
router.get('/admin/history', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0, userId } = req.query;
    
    let query = `
      SELECT ch.id, ch.user_id, u.username, ch.channel, 
             ch.sender_type, ch.content, ch.metadata, ch.created_at
      FROM chat_history ch
      LEFT JOIN users u ON ch.user_id = u.id
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (userId) {
      query += ` WHERE ch.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    query += ` ORDER BY ch.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching admin chat history:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обработчик для связывания гостевых сообщений с пользователем
router.post('/link-guest-messages', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const guestId = req.session.guestId;
    
    if (!guestId) {
      return res.json({ success: true, message: 'No guest messages to link' });
    }
    
    // Связываем гостевые сообщения с пользователем
    await db.query(`
      INSERT INTO messages (user_id, content, role, created_at)
      SELECT $1, content, CASE WHEN is_ai THEN 'assistant' ELSE 'user' END, created_at
      FROM guest_messages
      WHERE guest_id = $2
      ORDER BY created_at
    `, [userId, guestId]);
    
    // Удаляем гостевые сообщения
    await db.query(`
      DELETE FROM guest_messages
      WHERE guest_id = $1
    `, [guestId]);
    
    // Удаляем временный ID из сессии
    delete req.session.guestId;
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error linking guest messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновляем маршрут верификации кошелька
router.post('/verify', async (req, res) => {
  const { address, signature, message } = req.body;
  
  try {
    // ... существующий код верификации ...

    // После успешной верификации и создания пользователя
    if (req.session.guestId) {
      console.log('Found guest messages, processing...');
      await processGuestMessages(userId, req.session.guestId);
    }

    // Сохраняем данные в сессии
    req.session.userId = userId;
    req.session.address = address;
    req.session.isAdmin = isAdmin;
    req.session.authenticated = true;

    console.log('Authentication successful for user:', {
      userId,
      address,
      isAdmin,
      guestId: req.session.guestId
    });

    res.json({
      authenticated: true,
      userId: userId,
      address: address,
      isAdmin: isAdmin,
      authType: 'wallet'
    });

  } catch (error) {
    console.error('Error during wallet verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновляем маршрут верификации Telegram
router.post('/auth/telegram/verify', async (req, res) => {
  // ... существующий код ...

  if (result.success) {
    // Если есть гостевые сообщения, обрабатываем их
    if (req.session.guestId) {
      await processGuestMessages(userId, req.session.guestId);
    }

    res.json({
      success: true,
      userId: userId,
      telegramId: result.telegramId,
      isAdmin: req.session.isAdmin || false,
      authenticated: true
    });
  }
});

module.exports = router;
