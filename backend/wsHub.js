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

const WebSocket = require('ws');

let wss = null;
// Храним клиентов по userId для персонализированных уведомлений
const wsClients = new Map(); // userId -> Set of WebSocket connections

function initWSS(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    console.log('🔌 [WebSocket] Новое подключение');
    
    // Добавляем клиента в общий список
    if (!wsClients.has('anonymous')) {
      wsClients.set('anonymous', new Set());
    }
    wsClients.get('anonymous').add(ws);
    
    // Обработка сообщений от клиента
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('📨 [WebSocket] Получено сообщение:', data);
        
        if (data.type === 'auth' && data.userId) {
          // Аутентификация пользователя
          authenticateUser(ws, data.userId);
        }
      } catch (error) {
        console.error('❌ [WebSocket] Ошибка парсинга сообщения:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 [WebSocket] Соединение закрыто');
      // Удаляем клиента из всех списков
      for (const [userId, clients] of wsClients.entries()) {
        clients.delete(ws);
        if (clients.size === 0) {
          wsClients.delete(userId);
        }
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ [WebSocket] Ошибка соединения:', error);
    });
  });
  
  console.log('🚀 [WebSocket] Сервер запущен на /ws');
}

function authenticateUser(ws, userId) {
  console.log(`🔐 [WebSocket] Аутентификация пользователя ${userId}`);
  
  // Удаляем из анонимных
  if (wsClients.has('anonymous')) {
    wsClients.get('anonymous').delete(ws);
  }
  
  // Добавляем в список пользователя
  if (!wsClients.has(userId.toString())) {
    wsClients.set(userId.toString(), new Set());
  }
  wsClients.get(userId.toString()).add(ws);
  
  // Отправляем подтверждение
  ws.send(JSON.stringify({ 
    type: 'auth-success', 
    userId: userId 
  }));
}

function broadcastContactsUpdate() {
  console.log('📢 [WebSocket] Отправка обновления контактов всем клиентам');
  for (const [userId, clients] of wsClients.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'contacts-updated' }));
      }
    }
  }
}

function broadcastMessagesUpdate() {
  console.log('📢 [WebSocket] Отправка обновления сообщений всем клиентам');
  for (const [userId, clients] of wsClients.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'messages-updated' }));
      }
    }
  }
}

function broadcastChatMessage(message, targetUserId = null) {
  console.log(`📢 [WebSocket] Отправка сообщения чата`, { 
    messageId: message.id, 
    targetUserId 
  });
  
  if (targetUserId) {
    // Отправляем конкретному пользователю
    const userClients = wsClients.get(targetUserId.toString());
    if (userClients) {
      for (const ws of userClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'chat-message', 
            message 
          }));
        }
      }
    }
  } else {
    // Отправляем всем
    for (const [userId, clients] of wsClients.entries()) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'chat-message', 
            message 
          }));
        }
      }
    }
  }
}

function broadcastConversationUpdate(conversationId, targetUserId = null) {
  console.log(`📢 [WebSocket] Отправка обновления диалога`, { 
    conversationId, 
    targetUserId 
  });
  
  const payload = { 
    type: 'conversation-updated', 
    conversationId 
  };
  
  if (targetUserId) {
    // Отправляем конкретному пользователю
    const userClients = wsClients.get(targetUserId.toString());
    if (userClients) {
      for (const ws of userClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      }
    }
  } else {
    // Отправляем всем
    for (const [userId, clients] of wsClients.entries()) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }
      }
    }
  }
}

function getConnectedUsers() {
  const users = [];
  for (const [userId, clients] of wsClients.entries()) {
    if (userId !== 'anonymous' && clients.size > 0) {
      users.push({
        userId: parseInt(userId),
        connections: clients.size
      });
    }
  }
  return users;
}

function getStats() {
  let totalConnections = 0;
  let anonymousConnections = 0;
  
  for (const [userId, clients] of wsClients.entries()) {
    if (userId === 'anonymous') {
      anonymousConnections = clients.size;
    }
    totalConnections += clients.size;
  }
  
  return {
    totalConnections,
    anonymousConnections,
    authenticatedUsers: getConnectedUsers(),
    totalUsers: wsClients.size - (wsClients.has('anonymous') ? 1 : 0)
  };
}

module.exports = { 
  initWSS, 
  broadcastContactsUpdate, 
  broadcastMessagesUpdate, 
  broadcastChatMessage,
  broadcastConversationUpdate,
  getConnectedUsers,
  getStats
}; 