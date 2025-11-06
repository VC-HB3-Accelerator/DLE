/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const WebSocket = require('ws');
const tokenBalanceService = require('./services/tokenBalanceService');
const deploymentTracker = require('./utils/deploymentTracker');
const deploymentWebSocketService = require('./services/deploymentWebSocketService');
const logger = require('./utils/logger');

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
  logger.info('🔌 [WebSocket] Сервер инициализирован на пути /ws');
  
  // Инициализируем deploymentWebSocketService с WebSocket сервером после создания wss
  deploymentWebSocketService.initialize(server, wss);
  
  // Подключаем deployment tracker к WebSocket
  deploymentTracker.on('deployment_updated', (data) => {
    broadcastDeploymentUpdate(data);
  });
  
  // Дополнительная инициализация deploymentWebSocketService после создания wss
  logger.debug('[wsHub] Инициализируем deploymentWebSocketService с wss:', !!wss);
  deploymentWebSocketService.setWebSocketServer(wss);
  logger.debug('[wsHub] deploymentWebSocketService инициализирован');
  
  wss.on('connection', (ws, req) => {
    logger.debug('🔌 [WebSocket] Новое подключение');
    logger.debug('🔌 [WebSocket] IP клиента:', req.socket.remoteAddress);
    logger.debug('🔌 [WebSocket] User-Agent:', req.headers['user-agent']);
    logger.debug('🔌 [WebSocket] Origin:', req.headers.origin);
    
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

        if (data.type === 'ollama_ready') {
          // Уведомление о готовности Ollama - запускаем инициализацию ботов
          logger.debug('🚀 [WebSocket] Получено уведомление о готовности Ollama!');
          handleOllamaReady();
        }
        
        if (data.type === 'request_token_balances' && data.address) {
          // Запрос балансов токенов
          handleTokenBalancesRequest(ws, data.address, data.userId);
        }
        
        // Обработка сообщений для деплоя модулей
        if (data.type === 'subscribe' && data.dleAddress) {
          // Подписка на деплой для конкретного DLE
          deploymentWebSocketService.subscribeToDeployment(ws, data.dleAddress);
        }
        
        if (data.type === 'unsubscribe' && data.dleAddress) {
          // Отписка от деплоя
          deploymentWebSocketService.unsubscribeFromDeployment(ws, data.dleAddress);
        }
        
        // Обработка сообщений деплоя через deploymentWebSocketService
        if (data.type === 'deployment_log' || 
            data.type === 'deployment_started' || 
            data.type === 'deployment_status' ||
            data.type === 'deployment_finished' ||
            data.type === 'deployment_update') {
          // Эти сообщения обрабатываются в deploymentWebSocketService
          // Просто логируем для отладки
          logger.debug(`[WebSocket] Получено сообщение деплоя: ${data.type}`);
          logger.debug('[WebSocket] Данные:', JSON.stringify(data, null, 2));
        }
      } catch (error) {
        logger.debug('❌ [WebSocket] Ошибка парсинга сообщения:', error);
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
      
      // Удаляем клиента из deploymentWebSocketService
      deploymentWebSocketService.removeClient(ws);
    });
    
    ws.on('error', (error) => {
      logger.debug('❌ [WebSocket] Ошибка соединения:', error.message);
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

// Функции для уведомлений об изменениях токенов
function broadcastAuthTokenAdded(tokenData) {
  const message = JSON.stringify({
    type: 'auth_token_added',
    data: {
      token: tokenData,
      timestamp: Date.now()
    }
  });
  
  broadcastToAllClients(message);
}

function broadcastAuthTokenDeleted(tokenData) {
  const message = JSON.stringify({
    type: 'auth_token_deleted',
    data: {
      token: tokenData,
      timestamp: Date.now()
    }
  });
  
  broadcastToAllClients(message);
}

function broadcastAuthTokenUpdated(tokenData) {
  const message = JSON.stringify({
    type: 'auth_token_updated',
    data: {
      token: tokenData,
      timestamp: Date.now()
    }
  });
  
  broadcastToAllClients(message);
}

// Функции для балансов токенов
function broadcastTokenBalancesUpdate(userId, balances) {
  const message = JSON.stringify({
    type: 'token_balances_updated',
    data: {
      balances: balances,
      timestamp: Date.now()
    }
  });
  
  // Отправляем конкретному пользователю
  const userClients = wsClients.get(userId.toString());
  if (userClients) {
    for (const ws of userClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

function broadcastTokenBalanceChanged(userId, tokenAddress, newBalance, network) {
  const message = JSON.stringify({
    type: 'token_balance_changed',
    data: {
      tokenAddress: tokenAddress,
      balance: newBalance,
      network: network,
      timestamp: Date.now()
    }
  });
  
  // Отправляем конкретному пользователю
  const userClients = wsClients.get(userId.toString());
  if (userClients) {
    for (const ws of userClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

// Функции для деплоя
function broadcastDeploymentUpdate(data) {
  if (!wss) return;
  
  logger.debug('📡 [WebSocket] broadcastDeploymentUpdate вызвана с данными:', JSON.stringify(data, null, 2));
  
  const message = JSON.stringify({
    type: 'deployment_update',
    data: data
  });
  
  logger.debug('📡 [WebSocket] Отправляем сообщение:', message);
  
  // Отправляем всем подключенным клиентам
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        logger.error('[WebSocket] Ошибка при отправке deployment update:', error);
      }
    }
  });
  
  logger.debug('📡 [WebSocket] Отправлено deployment update: deployment_update');
}

// broadcastModulesUpdate удалена - используем deploymentWebSocketService.broadcastToDLE

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
  broadcastAuthTokenAdded,
  broadcastAuthTokenDeleted,
  broadcastAuthTokenUpdated,
  broadcastTokenBalancesUpdate,
  broadcastTokenBalanceChanged,
  broadcastDeploymentUpdate,
  getConnectedUsers,
  getStats
};

// Обработчик запроса балансов токенов
async function handleTokenBalancesRequest(ws, address, userId) {
  try {
    logger.debug(`[WebSocket] Запрос балансов для адреса: ${address}`);

    // Получаем балансы через отдельный сервис без зависимостей от wsHub
    const balances = await tokenBalanceService.getUserTokenBalances(address);
    
    logger.debug(`[WebSocket] Получены балансы для ${address}:`, balances);
    logger.debug('[WebSocket] Количество токенов:', balances?.length || 0);
    
    // Отправляем ответ клиенту
    const response = {
      type: 'token_balances_response',
      data: {
        address: address,
        balances: balances,
        timestamp: Date.now()
      }
    };
    
    logger.debug('[WebSocket] Отправляем ответ:', JSON.stringify(response, null, 2));
    ws.send(JSON.stringify(response));
  } catch (error) {
    logger.error('[WebSocket] Ошибка при получении балансов:', error);
    
    // Определяем тип ошибки для лучшей диагностики
    let errorType = 'Неизвестная ошибка';
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      errorType = 'Таймаут соединения - возможно, нужен VPN';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
      errorType = 'Не удается подключиться к RPC провайдеру';
    } else if (errorMessage.includes('TLS') || errorMessage.includes('socket disconnected')) {
      errorType = 'Проблема с TLS соединением - проверьте VPN';
    } else if (errorMessage.includes('NETWORK_ERROR')) {
      errorType = 'Ошибка сети - проверьте интернет-соединение';
    }
    
    // Отправляем ошибку клиенту
    const errorResponse = {
      type: 'token_balances_error',
      data: {
        address: address,
        error: errorType,
        errorDetails: errorMessage,
        timestamp: Date.now()
      }
    };
    
    logger.debug('[WebSocket] Отправляем ошибку клиенту:', JSON.stringify(errorResponse, null, 2));
    ws.send(JSON.stringify(errorResponse));
  }
}

/**
 * Обработка уведомления о готовности Ollama
 */
async function handleOllamaReady() {
  try {
    logger.debug('✅ [WebSocket] Ollama готов к работе');
    // Уведомляем всех подключенных клиентов о готовности системы
    broadcastSystemReady();
  } catch (error) {
    logger.error('❌ [WebSocket] Ошибка обработки Ollama ready:', error);
  }
}

/**
 * Уведомление всех клиентов о готовности системы
 */
function broadcastSystemReady() {
  const message = JSON.stringify({
    type: 'system_ready',
    data: {
      message: 'Все модели загружены! Система готова к работе.',
      timestamp: Date.now(),
      bots: ['web', 'telegram', 'email']
    }
  });
  
  // Отправляем всем подключенным клиентам
  wsClients.forEach((clientSet) => {
    clientSet.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  });
  
  logger.debug('📢 [WebSocket] Уведомление о готовности системы отправлено всем клиентам');
} 