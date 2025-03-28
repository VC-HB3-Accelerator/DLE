const express = require('express');
const router = express.Router();
const aiAssistant = require('../services/ai-assistant');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { saveGuestMessageToDatabase } = require('../db');

// Функция для обработки гостевых сообщений после аутентификации
async function processGuestMessages(userId, guestId) {
  try {
    console.log(`Processing guest messages for user ${userId} with guest ID ${guestId}`);
    
    // Получаем все гостевые сообщения
    const guestMessagesResult = await db.query(
      'SELECT * FROM guest_messages WHERE guest_id = $1 ORDER BY created_at ASC',
      [guestId]
    );
    
    if (guestMessagesResult.rows.length === 0) {
      console.log('No guest messages found');
      return { success: true, message: 'No guest messages found' };
    }
    
    const guestMessages = guestMessagesResult.rows;
    console.log(`Found ${guestMessages.length} guest messages`);
    
    // Создаем новый диалог для этих сообщений
    const firstMessage = guestMessages[0];
    const title = firstMessage.content.length > 30 
      ? `${firstMessage.content.substring(0, 30)}...` 
      : firstMessage.content;
    
    const newConversationResult = await db.query(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title]
    );
    
    const conversation = newConversationResult.rows[0];
    console.log('Created new conversation for guest messages:', conversation);
    
    // Обрабатываем каждое гостевое сообщение
    for (const guestMessage of guestMessages) {
      console.log(`Processing guest message ID ${guestMessage.id}: ${guestMessage.content}`);
      
      // Сохраняем сообщение пользователя
      const userMessageResult = await db.query(
        `INSERT INTO messages 
          (conversation_id, content, sender_type, role, guest_message_id, channel, created_at) 
         VALUES 
          ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          conversation.id, 
          guestMessage.content, 
          'user', 
          'user', 
          guestMessage.id,
          'web',
          guestMessage.created_at
        ]
      );
      
      console.log(`Saved user message with ID ${userMessageResult.rows[0].id}`);
      
      // Получаем ответ от ИИ
      console.log('Getting AI response for:', guestMessage.content);
      const language = guestMessage.language || 'auto';
      const aiResponse = await aiAssistant.getResponse(guestMessage.content, language);
      console.log('AI response received:', aiResponse);
      
      // Сохраняем ответ от ИИ
      const aiMessageResult = await db.query(
        `INSERT INTO messages 
          (conversation_id, content, sender_type, role, guest_message_id, channel, created_at) 
         VALUES 
          ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [
          conversation.id, 
          aiResponse, 
          'assistant', 
          'assistant', 
          guestMessage.id,
          'web',
          new Date()
        ]
      );
      
      console.log(`Saved AI response with ID ${aiMessageResult.rows[0].id}`);
    }
    
    // Удаляем гостевые сообщения, так как они уже обработаны
    await db.query('DELETE FROM guest_messages WHERE guest_id = $1', [guestId]);
    console.log('Deleted processed guest messages');
    
    return { 
      success: true, 
      message: `Processed ${guestMessages.length} guest messages`,
      conversationId: conversation.id
    };
  } catch (error) {
    console.error('Error processing guest messages:', error);
    throw error;
  }
}

// Обработчик для гостевых сообщений
router.post('/guest-message', async (req, res) => {
  try {
    const { message, language } = req.body;
    const guestId = req.session.guestId || crypto.randomBytes(16).toString('hex');

    // Сохраняем ID гостя в сессии
    req.session.guestId = guestId;
    await req.session.save();

    console.log('Saving guest message:', { guestId, message });

    // Сохраняем сообщение пользователя
    const result = await db.query(
      'INSERT INTO guest_messages (guest_id, content, language, is_ai) VALUES ($1, $2, $3, false) RETURNING id',
      [guestId, message, language]
    );

    console.log('Guest message saved:', result.rows[0]);

    res.json({ 
      success: true, 
      messageId: result.rows[0].id
    });
  } catch (error) {
    console.error('Error saving guest message:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Маршрут для обычных сообщений (для аутентифицированных пользователей)
router.post('/message', requireAuth, async (req, res) => {
  const { message, conversationId, language = 'auto' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.log('Processing message:', { message, conversationId, language, userId: req.session.userId });
    const userId = req.session.userId;
    
    let conversation;
    
    // Если указан ID диалога, проверяем его существование и принадлежность пользователю
    if (conversationId) {
      const conversationResult = await db.query(
        'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId]
      );
      
      if (conversationResult.rows.length === 0) {
        return res.status(404).json({ error: 'Conversation not found or access denied' });
      }
      
      conversation = conversationResult.rows[0];
      console.log('Using existing conversation:', conversation);
    } else {
      // Создаем новый диалог
      const title = message.length > 30 ? `${message.substring(0, 30)}...` : message;
      
      const newConversationResult = await db.query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, title]
      );
      
      conversation = newConversationResult.rows[0];
      console.log('Created new conversation:', conversation);
    }
    
    // Сохраняем сообщение пользователя
    console.log('Saving user message');
    const userMessageResult = await db.query(
      `INSERT INTO messages 
        (conversation_id, content, sender_type, role, tokens_used, channel, created_at) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [conversation.id, message, 'user', 'user', 0, 'web', new Date()]
    );
    
    // Получаем ответ от ИИ
    console.log('Getting AI response');
    const aiResponse = await aiAssistant.getResponse(message, language);
    console.log('AI response received:', aiResponse);
    
    // Сохраняем ответ от ИИ
    console.log('Saving AI response');
    const aiMessageResult = await db.query(
      `INSERT INTO messages 
        (conversation_id, content, sender_type, role, tokens_used, channel, created_at) 
       VALUES 
        ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [conversation.id, aiResponse, 'assistant', 'assistant', 0, 'web', new Date()]
    );
    
    const response = {
      success: true,
      userMessage: userMessageResult.rows[0],
      aiMessage: aiMessageResult.rows[0],
      conversation
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Error processing message' });
  }
});

// Добавьте этот маршрут для проверки доступных моделей
router.get('/models', async (req, res) => {
  try {
    const models = await aiAssistant.getAvailableModels();

    res.json({
      success: true,
      models: models,
    });
  } catch (error) {
    console.error('Ошибка при получении списка моделей:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Получение истории сообщений
router.get('/history', async (req, res) => {
  try {
    console.log('Session in history route:', {
      id: req.sessionID,
      userId: req.session.userId,
      address: req.session.address,
      authenticated: req.session.authenticated,
      guestId: req.session.guestId
    });
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    let messages = [];
    let total = 0;

    // Если пользователь аутентифицирован, получаем его сообщения
    if (req.session.authenticated && req.session.userId) {
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE c.user_id = $1`,
        [req.session.userId]
      );
      total = parseInt(countResult.rows[0].total) || 0;

      const result = await db.query(
        `SELECT 
           m.id, 
           m.content, 
           m.sender_type,
           m.role,
           m.created_at,
           c.user_id,
           c.id as conversation_id
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         WHERE c.user_id = $1
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.session.userId, limit, offset]
      );
      
      messages = result.rows;
      console.log(`Found ${messages.length} messages for authenticated user`);
    }
    // Если есть guestId, получаем гостевые сообщения
    else if (req.session.guestId) {
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM guest_messages
         WHERE guest_id = $1`,
        [req.session.guestId]
      );
      total = parseInt(countResult.rows[0].total) || 0;

      const result = await db.query(
        `SELECT 
           id, 
           content, 
           'user' as sender_type, 
           'user' as role, 
           created_at,
           guest_id as user_id,
           NULL as conversation_id
         FROM guest_messages
         WHERE guest_id = $1
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3`,
        [req.session.guestId, limit, offset]
      );
      
      messages = result.rows;
      console.log(`Found ${messages.length} guest messages`);
    }

    return res.json({
      success: true,
      messages: messages,
      total: total
    });

  } catch (error) {
    logger.error('Error getting chat history:', error);
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
    const { userId } = req.session;
    const guestId = req.session.guestId;

    console.log('Linking messages:', { userId, guestId });

    if (!guestId) {
      console.log('No guestId in session');
      return res.json({ success: true, message: 'No guest messages to link' });
    }

    // Проверяем наличие гостевых сообщений
    const guestMessagesCheck = await db.query(
      'SELECT EXISTS(SELECT 1 FROM guest_messages WHERE guest_id = $1)',
      [guestId]
    );

    console.log('Guest messages check:', guestMessagesCheck.rows[0]);

    if (!guestMessagesCheck.rows[0].exists) {
      console.log('No guest messages found for guestId:', guestId);
      return res.json({ success: true, message: 'No guest messages to link' });
    }

    try {
      // Обрабатываем гостевые сообщения для получения ответов от AI
      console.log('Processing guest messages to get AI responses');
      const result = await processGuestMessages(userId, guestId);
      console.log('Guest messages processed:', result);
      
      // Очищаем guestId из сессии после связывания
      req.session.guestId = null;
      await req.session.save();
      
      console.log('Messages linked and processed successfully');
      return res.json({ 
        success: true,
        message: 'Guest messages linked and processed',
        result
      });
    } catch (processError) {
      console.error('Error processing guest messages:', processError);
      return res.status(500).json({ 
        success: false, 
        error: 'Error processing guest messages',
        details: processError.message
      });
    }
  } catch (error) {
    console.error('Error linking guest messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message
    });
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

// Маршрут для удаления сообщений
router.delete('/message/:id', requireAuth, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.session.userId;

    // Проверяем права на удаление
    const messageCheck = await db.query(
      `SELECT m.id 
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE m.id = $1 AND c.user_id = $2`,
      [messageId, userId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Удаляем сообщение
    await db.query(
      'DELETE FROM messages WHERE id = $1',
      [messageId]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для проверки и инициализации сессии
router.get('/check-session', async (req, res) => {
  try {
    // Если у пользователя нет guestId, создаем его
    if (!req.session.guestId) {
      req.session.guestId = crypto.randomBytes(16).toString('hex');
      await req.session.save();
      console.log('Created new guestId:', req.session.guestId);
    }
    
    res.json({
      success: true,
      guestId: req.session.guestId,
      isAuthenticated: req.session.authenticated || false
    });
  } catch (error) {
    console.error('Error checking session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
