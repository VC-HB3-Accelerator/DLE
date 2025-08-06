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

// Кэш для отслеживания изменений тегов
const tagsChangeCache = new Map();
const TAGS_CACHE_TTL = 5000; // 5 секунд

// Дебаунс для broadcastTagsUpdate
let tagsUpdateTimeout = null;
const TAGS_UPDATE_DEBOUNCE = 100; // 100ms

function initWSS(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    // console.log('🔌 [WebSocket] Новое подключение');
    // console.log('🔌 [WebSocket] IP клиента:', req.socket.remoteAddress);
    // console.log('🔌 [WebSocket] User-Agent:', req.headers['user-agent']);
    // console.log('🔌 [WebSocket] Origin:', req.headers.origin);
    
    // Добавляем клиента в общий список
    if (!wsClients.has('anonymous')) {
      wsClients.set('anonymous', new Set());
    }
    wsClients.get('anonymous').add(ws);
    
    // Обработка сообщений от клиента
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        // console.log('📨 [WebSocket] Получено сообщение:', data);
        
        if (data.type === 'auth' && data.userId) {
          // Аутентификация пользователя
          authenticateUser(ws, data.userId);
        }
        
        if (data.type === 'ping') {
          // Отправляем pong ответ
          ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: data.timestamp 
          }));
        }
      } catch (error) {
        // console.error('❌ [WebSocket] Ошибка парсинга сообщения:', error);
      }
    });
    
    ws.on('close', (code, reason) => {
      // console.log('🔌 [WebSocket] Соединение закрыто', { code, reason: reason.toString() });
      // Удаляем клиента из всех списков
      for (const [userId, clients] of wsClients.entries()) {
        clients.delete(ws);
        if (clients.size === 0) {
          wsClients.delete(userId);
        }
      }
    });
    
    ws.on('error', (error) => {
      // console.error('❌ [WebSocket] Ошибка соединения:', error.message);
    });
  });
  
  // console.log('🚀 [WebSocket] Сервер запущен на /ws');
}

function authenticateUser(ws, userId) {
  // console.log(`🔐 [WebSocket] Аутентификация пользователя ${userId}`);
  
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
  // console.log('📢 [WebSocket] Отправка обновления контактов всем клиентам');
  for (const [userId, clients] of wsClients.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'contacts-updated' }));
      }
    }
  }
}

function broadcastMessagesUpdate() {
  // console.log('📢 [WebSocket] Отправка обновления сообщений всем клиентам');
  for (const [userId, clients] of wsClients.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'messages-updated' }));
      }
    }
  }
}

function broadcastChatMessage(message, targetUserId = null) {
  // console.log(`📢 [WebSocket] Отправка сообщения чата`, { 
  //   messageId: message.id, 
  //   targetUserId 
  // });
  
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
  // console.log(`📢 [WebSocket] Отправка обновления диалога`, { 
  //   conversationId, 
  //   targetUserId 
  // });
  
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

function broadcastTableUpdate(tableId) {
  // console.log('📢 [WebSocket] Отправка обновления таблицы', tableId);
  const payload = { type: 'table-updated', tableId };
    for (const [userId, clients] of wsClients.entries()) {
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
      }
    }
  }
}

function broadcastTableRelationsUpdate(tableId, rowId, targetUserId = null) {
  // console.log(`📢 [WebSocket] Отправка обновления связей таблицы`, { 
  //   tableId, 
  //   rowId, 
  //   targetUserId 
  // });
  
  const payload = { 
    type: 'table-relations-updated', 
    tableId, 
    rowId 
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

function broadcastTagsUpdate(targetUserId = null, rowId = null) {
  // Дебаунс: отменяем предыдущий таймаут
  if (tagsUpdateTimeout) {
    clearTimeout(tagsUpdateTimeout);
  }
  
  // Устанавливаем новый таймаут
  tagsUpdateTimeout = setTimeout(() => {
    // console.log('🔔 [WebSocket] Отправляем уведомление об обновлении тегов', rowId ? `для строки ${rowId}` : '');
    const message = JSON.stringify({
      type: 'tags-updated',
      timestamp: Date.now(),
      rowId: rowId // Добавляем информацию о конкретной строке
    });
    
    let sentCount = 0;
    // Отправляем всем подключенным клиентам
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sentCount++;
      }
    });
    
    // console.log(`🔔 [WebSocket] Отправлено tags-updated ${sentCount} клиентам`);
  }, TAGS_UPDATE_DEBOUNCE);
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

// Функция для отправки уведомлений о статусе AI
function broadcastAIStatus(status) {
  // console.log('📢 [WebSocket] Отправка статуса AI всем клиентам');
  for (const [userId, clients] of wsClients.entries()) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'ai-status', 
          status 
        }));
      }
    }
  }
}

// Blockchain уведомления
function broadcastProposalCreated(dleAddress, proposalId, txHash) {
  const message = JSON.stringify({
    type: 'proposal_created',
    data: {
      dleAddress: dleAddress,
      proposalId: proposalId,
      txHash: txHash
    },
    timestamp: Date.now()
  });
  
  broadcastToAllClients(message);
}

function broadcastProposalVoted(dleAddress, proposalId, support, txHash) {
  const message = JSON.stringify({
    type: 'proposal_voted',
    data: {
      dleAddress: dleAddress,
      proposalId: proposalId,
      support: support,
      txHash: txHash
    },
    timestamp: Date.now()
  });
  
  broadcastToAllClients(message);
}

function broadcastProposalExecuted(dleAddress, proposalId, txHash) {
  const message = JSON.stringify({
    type: 'proposal_executed',
    data: {
      dleAddress: dleAddress,
      proposalId: proposalId,
      txHash: txHash
    },
    timestamp: Date.now()
  });
  
  broadcastToAllClients(message);
}

function broadcastToAllClients(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

module.exports = { 
  initWSS, 
  broadcastContactsUpdate, 
  broadcastMessagesUpdate, 
  broadcastChatMessage,
  broadcastConversationUpdate,
  broadcastTableUpdate,
  broadcastTableRelationsUpdate,
  broadcastTagsUpdate,
  broadcastAIStatus,
  broadcastProposalCreated,
  broadcastProposalVoted,
  broadcastProposalExecuted,
  getConnectedUsers,
  getStats
}; 