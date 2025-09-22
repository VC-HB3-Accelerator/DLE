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
  }

  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:8000/ws');
      
      this.ws.onopen = () => {
        console.log('[WebSocket] Подключение установлено');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Получено сообщение:', data);
          
          // Вызываем все зарегистрированные обработчики для этого события
          if (this.listeners.has(data.type)) {
            this.listeners.get(data.type).forEach(callback => {
              callback(data.data);
            });
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
      console.log(`[WebSocket] Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[WebSocket] Превышено максимальное количество попыток переподключения');
    }
  }

  disconnect() {
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