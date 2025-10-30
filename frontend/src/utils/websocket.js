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
 * WebSocket клиент для автоматического обновления данных
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000; // 30 секунд
  }

  connect() {
    // Если уже подключены, не создаем новое соединение
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Уже подключены, пропускаем');
      return;
    }

    // Закрываем предыдущее соединение если есть
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      // В Docker окружении используем Vite прокси для WebSocket
      // Используем относительный путь, чтобы Vite прокси мог перенаправить запрос на backend
      const wsUrl = window.location.protocol === 'https:' 
        ? 'wss://' + window.location.host + '/ws'
        : 'ws://' + window.location.host + '/ws';
      
      console.log('[WebSocket] Подключаемся к:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Подключение установлено');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Запускаем heartbeat
        this.startHeartbeat();
        
        // Уведомляем о подключении
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Обрабатываем pong сообщения для heartbeat
          if (data.type === 'pong') {
            console.log('[WebSocket] Получен pong, соединение активно');
            return;
          }
          
          // Логируем все deployment_update сообщения для отладки
          if (data.type === 'deployment_update') {
            console.log('[WebSocket] Получено deployment_update:', data);
            console.log('[WebSocket] Данные для обработчика:', data.data);
          }
          
          // Вызываем все зарегистрированные обработчики для этого события
          if (this.listeners.has(data.type)) {
            console.log(`[WebSocket] Вызываем обработчики для типа: ${data.type}, количество: ${this.listeners.get(data.type).length}`);
            this.listeners.get(data.type).forEach(callback => {
              // Передаем весь объект data, а не только data.data
              callback(data);
            });
          } else {
            // Не логируем сообщения о деплое, они обрабатываются в других компонентах
            if (!data.type?.startsWith('deployment_') && !data.type?.startsWith('module_') && data.type !== 'subscribed' && data.type !== 'pong') {
              console.log(`[WebSocket] Нет обработчиков для типа: ${data.type}`);
            }
          }
        } catch (error) {
          console.error('[WebSocket] Ошибка парсинга сообщения:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Соединение закрыто');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Ошибка:', error);
        this.isConnected = false;
      };

    } catch (error) {
      console.error('[WebSocket] Ошибка подключения:', error);
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts} через ${this.reconnectDelay * this.reconnectAttempts}мс`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.connect();
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[WebSocket] Превышено максимальное количество попыток переподключения');
      // Сбрасываем счетчик через 30 секунд для повторных попыток
      setTimeout(() => {
        this.reconnectAttempts = 0;
        console.log('[WebSocket] Сброс счетчика переподключений, можно попробовать снова');
      }, 30000);
    }
  }

  startHeartbeat() {
    // Очищаем предыдущий интервал
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Отправляем ping каждые 30 секунд
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send('ping', { timestamp: Date.now() });
      } else {
        console.log('[WebSocket] Соединение потеряно, переподключаемся...');
        this.isConnected = false;
        this.scheduleReconnect();
      }
    }, this.heartbeatTimeout);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  // Регистрация обработчика события
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Удаление обработчика события
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Эмиссия события
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Алиас для on() - для совместимости с useDeploymentWebSocket
  subscribe(event, callback) {
    this.on(event, callback);
  }

  // Алиас для off() - для совместимости с useDeploymentWebSocket  
  unsubscribe(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
        console.log(`[WebSocket] Отписались от события: ${event}`);
      }
    }
  }

  // Отправка сообщения на сервер
  send(event, data) {
    if (this.ws && this.isConnected) {
      const message = JSON.stringify({
        event: event,
        data: data,
        timestamp: Date.now()
      });
      this.ws.send(message);
    } else {
      console.warn('[WebSocket] Не удалось отправить сообщение: соединение не установлено');
    }
  }

  // Подписка на обновления предложений для конкретного DLE
  subscribeToProposals(dleAddress) {
    this.send('subscribe', {
      type: 'proposals',
      dleAddress: dleAddress
    });
  }

  // Отписка от обновлений предложений
  unsubscribeFromProposals(dleAddress) {
    this.send('unsubscribe', {
      type: 'proposals',
      dleAddress: dleAddress
    });
  }

  // Обработчики для токенов аутентификации
  onAuthTokenAdded(callback) {
    this.on('auth_token_added', callback);
  }

  onAuthTokenDeleted(callback) {
    this.on('auth_token_deleted', callback);
  }

  onAuthTokenUpdated(callback) {
    this.on('auth_token_updated', callback);
  }
}

// Создаем глобальный экземпляр WebSocket клиента
const wsClient = new WebSocketClient();

// Автоматически подключаемся при импорте модуля
wsClient.connect();

export default wsClient; 