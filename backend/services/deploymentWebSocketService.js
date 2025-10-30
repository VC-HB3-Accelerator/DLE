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

/**
 * WebSocket сервис для отслеживания деплоя модулей
 * Обеспечивает реальное время обновления статуса деплоя
 */

const WebSocket = require('ws');

class DeploymentWebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map для хранения клиентов по dleAddress
    this.deploymentSessions = new Map(); // Map для хранения сессий деплоя
  }

  /**
   * Инициализация WebSocket сервера
   */
  initialize(server, wss) {
    // Сохраняем ссылку на WebSocket сервер для отправки сообщений
    this.wss = wss;
    console.log('[DeploymentWS] WebSocket сервис для деплоя инициализирован');
  }

  /**
   * Установка WebSocket сервера (дополнительная инициализация)
   */
  setWebSocketServer(wss) {
    this.wss = wss;
    console.log('[DeploymentWS] WebSocket сервер установлен, wss:', !!wss, 'clients:', wss ? wss.clients.size : 'N/A');
  }

  /**
   * Обработка входящих сообщений
   */
  handleMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        this.subscribeToDeployment(ws, data.dleAddress);
        break;
      case 'unsubscribe':
        this.unsubscribeFromDeployment(ws, data.dleAddress);
        break;
      default:
        this.sendError(ws, 'Неизвестный тип сообщения');
    }
  }

  /**
   * Подписка на деплой для конкретного DLE
   */
  subscribeToDeployment(ws, dleAddress) {
    if (!dleAddress) {
      this.sendError(ws, 'Адрес DLE обязателен');
      return;
    }

    console.log(`[DeploymentWS] Подписка на деплой DLE: ${dleAddress}`);
    
    // Сохраняем клиента
    ws.dleAddress = dleAddress;
    if (!this.clients.has(dleAddress)) {
      this.clients.set(dleAddress, new Set());
    }
    this.clients.get(dleAddress).add(ws);

    // Отправляем подтверждение подписки
    this.sendToClient(ws, {
      type: 'subscribed',
      dleAddress: dleAddress,
      message: 'Подписка на деплой активирована'
    });

    // Если есть активная сессия деплоя, отправляем текущий статус
    if (this.deploymentSessions.has(dleAddress)) {
      const session = this.deploymentSessions.get(dleAddress);
      this.sendToClient(ws, {
        type: 'deployment_status',
        dleAddress: dleAddress,
        ...session
      });
    }
  }

  /**
   * Отписка от деплоя
   */
  unsubscribeFromDeployment(ws, dleAddress) {
    if (ws.dleAddress === dleAddress) {
      this.removeClient(ws);
    }
  }

  /**
   * Удаление клиента из всех подписок
   */
  removeClient(ws) {
    if (ws.dleAddress && this.clients.has(ws.dleAddress)) {
      this.clients.get(ws.dleAddress).delete(ws);
      if (this.clients.get(ws.dleAddress).size === 0) {
        this.clients.delete(ws.dleAddress);
        // Очищаем сессию деплоя если нет активных клиентов
        if (this.deploymentSessions.has(ws.dleAddress)) {
          console.log(`[DeploymentWS] Очистка сессии деплоя для DLE: ${ws.dleAddress}`);
          this.deploymentSessions.delete(ws.dleAddress);
        }
      }
    }
  }

  /**
   * Начало сессии деплоя
   */
  startDeploymentSession(dleAddress, moduleType) {
    const session = {
      dleAddress: dleAddress,
      moduleType: moduleType,
      status: 'starting',
      progress: 0,
      step: 0,
      message: 'Инициализация деплоя...',
      logs: [],
      startTime: new Date().toISOString()
    };

    this.deploymentSessions.set(dleAddress, session);
    
    console.log(`[DeploymentWS] Начало деплоя: ${moduleType} для DLE ${dleAddress}`);
    
    this.broadcastToDLE(dleAddress, {
      type: 'deployment_started',
      ...session
    });

    return session;
  }

  /**
   * Обновление статуса деплоя
   */
  updateDeploymentStatus(dleAddress, updates) {
    const session = this.deploymentSessions.get(dleAddress);
    if (!session) {
      console.warn(`[DeploymentWS] Сессия деплоя не найдена для DLE: ${dleAddress}`);
      return;
    }

    // Обновляем сессию
    Object.assign(session, updates);
    session.lastUpdate = new Date().toISOString();

    console.log(`[DeploymentWS] Обновление статуса деплоя DLE ${dleAddress}:`, updates);
    
    this.broadcastToDLE(dleAddress, {
      type: 'deployment_status',
      ...session
    });
  }

  /**
   * Добавление лога в сессию деплоя
   */
  addDeploymentLog(dleAddress, logType, message) {
    const session = this.deploymentSessions.get(dleAddress);
    if (!session) {
      console.warn(`[DeploymentWS] Сессия деплоя не найдена для DLE: ${dleAddress}`);
      return;
    }

    const logEntry = {
      type: logType,
      message: message,
      timestamp: new Date().toISOString()
    };

    session.logs.push(logEntry);
    
    console.log(`[DeploymentWS] Лог деплоя DLE ${dleAddress}:`, logEntry);
    
    this.broadcastToDLE(dleAddress, {
      type: 'deployment_log',
      dleAddress: dleAddress,
      log: logEntry
    });
  }

  /**
   * Завершение сессии деплоя
   */
  finishDeploymentSession(dleAddress, success, message = null) {
    const session = this.deploymentSessions.get(dleAddress);
    if (!session) {
      console.warn(`[DeploymentWS] Сессия деплоя не найдена для DLE: ${dleAddress}`);
      return;
    }

    session.status = success ? 'completed' : 'failed';
    session.progress = success ? 100 : session.progress;
    session.endTime = new Date().toISOString();
    session.message = message || (success ? 'Деплой завершен успешно' : 'Деплой завершен с ошибкой');

    console.log(`[DeploymentWS] Завершение деплоя DLE ${dleAddress}: ${session.status}`);
    
    this.broadcastToDLE(dleAddress, {
      type: 'deployment_finished',
      ...session
    });

    // Удаляем сессию через 30 секунд
    setTimeout(() => {
      this.deploymentSessions.delete(dleAddress);
    }, 30000);
  }

  /**
   * Отправка сообщения конкретному клиенту
   */
  sendToClient(ws, message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[DeploymentWS] Ошибка отправки сообщения клиенту:', error);
      }
    }
  }

  /**
   * Отправка сообщения всем клиентам конкретного DLE
   */
  broadcastToDLE(dleAddress, message) {
    console.log('[DeploymentWS] broadcastToDLE вызвана, this.wss:', !!this.wss);
    if (!this.wss) {
      console.warn('[DeploymentWS] WebSocket сервер не инициализирован');
      return;
    }

    // Отправляем сообщение только клиентам, подписанным на этот DLE
    if (this.clients.has(dleAddress)) {
      const clients = this.clients.get(dleAddress);
      console.log(`[DeploymentWS] Отправляем сообщение ${dleAddress} клиентам: ${clients.size}`);
      clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify(message));
          } catch (error) {
            console.error('[DeploymentWS] Ошибка отправки сообщения:', error);
          }
        }
      });
    } else {
      console.log(`[DeploymentWS] Нет клиентов для DLE: ${dleAddress}`);
    }
  }

  /**
   * Отправка ошибки клиенту
   */
  sendError(ws, errorMessage) {
    this.sendToClient(ws, {
      type: 'error',
      message: errorMessage
    });
  }

  /**
   * Уведомление об обновлении модулей
   */
  notifyModulesUpdated(dleAddress) {
    console.log(`[DeploymentWS] Уведомление об обновлении модулей для DLE: ${dleAddress}`);
    
    this.broadcastToDLE(dleAddress, {
      type: 'modules_updated',
      dleAddress: dleAddress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Уведомление о верификации модуля
   */
  notifyModuleVerified(dleAddress, moduleType, networkName) {
    console.log(`[DeploymentWS] Уведомление о верификации модуля ${moduleType} в сети ${networkName} для DLE: ${dleAddress}`);
    
    this.broadcastToDLE(dleAddress, {
      type: 'module_verified',
      dleAddress: dleAddress,
      moduleType: moduleType,
      networkName: networkName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Уведомление об изменении статуса модуля
   */
  notifyModuleStatusChanged(dleAddress, moduleType, status) {
    console.log(`[DeploymentWS] Уведомление об изменении статуса модуля ${moduleType} на ${status} для DLE: ${dleAddress}`);
    
    this.broadcastToDLE(dleAddress, {
      type: 'module_status_changed',
      dleAddress: dleAddress,
      moduleType: moduleType,
      status: status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Получение статистики
   */
  getStats() {
    const totalClients = Array.from(this.clients.values()).reduce((sum, clients) => sum + clients.size, 0);
    return {
      activeConnections: totalClients,
      activeSessions: this.deploymentSessions.size,
      subscriptions: this.clients.size
    };
  }
}

// Создаем единственный экземпляр сервиса
const deploymentWebSocketService = new DeploymentWebSocketService();

module.exports = deploymentWebSocketService;
