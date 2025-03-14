const express = require('express');
const router = express.Router();
const { ChatOllama } = require('@langchain/ollama');
const { getVectorStore } = require('../services/vectorStore');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const crypto = require('crypto');

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

// Обработчик сообщений чата
router.post('/message', requireAuth, async (req, res) => {
  console.log('Сессия в /api/chat/message:', req.session);
  console.log('Аутентифицирован:', req.session.authenticated);
  
  try {
    const { message, language = 'ru' } = req.body;
    const userId = typeof req.session.userId === 'object' 
      ? req.session.userId.userId 
      : req.session.userId;
    
    console.log(`Получено сообщение: ${message}, язык: ${language}, userId: ${userId}`);

    // Проверяем, что userId существует
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

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

    // Отправляем запрос к Ollama с указанием языка
    console.log(`Отправка запроса к Ollama (модель: ${process.env.OLLAMA_MODEL || 'mistral'}, язык: ${detectedLanguage}): ${message}`);
    
    // Проверяем доступность Ollama
    console.log('Проверка доступности Ollama...');
    try {
      const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
      const data = await response.json();
      console.log('Ollama доступен. Доступные модели:');
      data.models.forEach(model => {
        console.log(`- ${model.name}`);
      });
    } catch (error) {
      console.error('Ошибка при проверке доступности Ollama:', error);
      return res.status(500).json({ error: 'Сервис Ollama недоступен' });
    }

    // Создаем экземпляр ChatOllama
    const chat = new ChatOllama({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'mistral',
      system: systemPrompt
    });

    console.log('Отправка запроса к Ollama...');
    
    // Получаем ответ от модели
    let aiResponse;
    try {
      const response = await chat.invoke(message);
      aiResponse = response.content;
      console.log('Ответ AI:', aiResponse);
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
        aiResponse = data.response;
        console.log('Ответ AI (альтернативный метод):', aiResponse);
      } catch (fallbackError) {
        console.error('Ошибка при использовании альтернативного метода:', fallbackError);
        throw error; // Выбрасываем исходную ошибку
      }
    }

    // Получаем или создаем диалог
    let conversationId;
    const conversationResult = await db.query(`
      SELECT id FROM conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId]);

    if (conversationResult.rows.length === 0) {
      // Создаем новый диалог
      const newConversationResult = await db.query(`
        INSERT INTO conversations (user_id, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        RETURNING id
      `, [userId]);
      conversationId = newConversationResult.rows[0].id;
      console.log('Created new conversation:', conversationId);
    } else {
      conversationId = conversationResult.rows[0].id;
      console.log('Using existing conversation:', conversationId);
    }

    // Сохраняем сообщение пользователя
    const userMessageResult = await db.query(`
      INSERT INTO messages (conversation_id, sender_type, sender_id, content, channel, created_at)
      VALUES ($1, 'user', $2, $3, 'web', NOW())
      RETURNING id
    `, [conversationId, userId, message]);
    console.log('Saved user message:', userMessageResult.rows[0].id);

    // Сохраняем ответ ИИ
    const aiMessageResult = await db.query(`
      INSERT INTO messages (conversation_id, sender_type, content, channel, created_at)
      VALUES ($1, 'ai', $2, 'web', NOW())
      RETURNING id
    `, [conversationId, aiResponse]);
    console.log('Saved AI message:', aiMessageResult.rows[0].id);

    // Обновляем время последнего сообщения в диалоге
    await db.query(`
      UPDATE conversations
      SET updated_at = NOW()
      WHERE id = $1
    `, [conversationId]);

    res.json({
      reply: aiResponse,
      language: detectedLanguage
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
router.get('/history', requireAuth, async (req, res) => {
  try {
    // Получаем ID пользователя из сессии или из объекта пользователя
    const userId = req.session?.userId || req.user?.userId;
    
    console.log('Запрос истории чата для пользователя:', userId);
    console.log('User object from request:', req.user);
    
    // Проверяем, что userId существует
    if (!userId) {
      console.error('Пользователь не аутентифицирован');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Получаем историю сообщений из базы данных
    console.log('Querying chat history for user:', userId);
    
    // Проверяем, существует ли таблица messages
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'messages'
        );
      `);
      
      console.log('Table messages exists:', tableCheck.rows[0].exists);
      
      if (tableCheck.rows[0].exists) {
        // Используем таблицу messages
        const result = await db.query(`
          SELECT m.*, c.user_id
          FROM messages m
          JOIN conversations c ON m.conversation_id = c.id
          WHERE c.user_id = $1
          ORDER BY m.created_at ASC
        `, [userId]);
        
        console.log(`Найдено ${result.rows.length} сообщений для пользователя ${userId}`);
        
        return res.json({ messages: result.rows });
      } else {
        // Проверяем, существует ли таблица chat_history
        const chatHistoryCheck = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'chat_history'
          );
        `);
        
        console.log('Table chat_history exists:', chatHistoryCheck.rows[0].exists);
        
        if (chatHistoryCheck.rows[0].exists) {
          // Используем таблицу chat_history
          const result = await db.query(`
            SELECT * FROM chat_history
            WHERE user_id = $1
            ORDER BY created_at ASC
          `, [userId]);
          
          console.log(`Найдено ${result.rows.length} сообщений для пользователя ${userId}`);
          
          return res.json({ messages: result.rows });
        } else {
          // Ни одна из таблиц не существует
          console.log('No message tables found in database');
          return res.json({ messages: [] });
        }
      }
    } catch (error) {
      console.error('Error checking tables:', error);
      return res.json({ messages: [] });
    }
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Обработчик для гостевых сообщений
router.post('/guest-message', async (req, res) => {
  try {
    const { message, language } = req.body;
    console.log(`Получено гостевое сообщение: ${message} язык: ${language}`);
    
    // Генерируем временный ID сессии, если его нет
    if (!req.session.guestId) {
      req.session.guestId = crypto.randomBytes(16).toString('hex');
    }
    
    // Сохраняем сообщение в базе данных с временным ID
    await db.query(`
      INSERT INTO guest_messages (guest_id, content, language, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [req.session.guestId, message, language]);
    
    // Отправляем запрос к AI
    const aiResponse = await getAIResponse(message, language);
    
    // Сохраняем ответ AI в базе данных
    await db.query(`
      INSERT INTO guest_messages (guest_id, content, language, created_at, is_ai)
      VALUES ($1, $2, $3, NOW(), true)
    `, [req.session.guestId, aiResponse, language]);
    
    return res.json({ message: aiResponse, reply: aiResponse });
  } catch (error) {
    console.error('Error processing guest message:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

module.exports = router;
