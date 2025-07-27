/**
 * WebSocket сервис для реального времени обновлений
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // 1 секунда
    this.listeners = new Map();
    this.userId = null;
  }

  // Подключение к WebSocket серверу
  connect(userId = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('🔌 [WebSocket] Уже подключен');
      return;
    }

    this.userId = userId;
    
    try {
      // Определяем WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // В Docker окружении backend работает на порту 8000
      const backendHost = window.location.hostname + ':8000';
      const wsUrl = `${protocol}//${backendHost}/ws`;
      
      console.log('🔌 [WebSocket] Подключение к:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ [WebSocket] Подключение установлено');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Аутентификация пользователя
        if (this.userId) {
          this.send({
            type: 'auth',
            userId: this.userId
          });
        }
        
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 [WebSocket] Получено сообщение:', data);
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ [WebSocket] Ошибка парсинга сообщения:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('🔌 [WebSocket] Соединение закрыто:', event.code, event.reason);
        this.isConnected = false;
        this.emit('disconnected', event);
        
        // Попытка переподключения
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 [WebSocket] Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          
          setTimeout(() => {
            this.connect(this.userId);
          }, this.reconnectDelay * this.reconnectAttempts);
        } else {
          console.error('❌ [WebSocket] Превышено максимальное количество попыток переподключения');
          this.emit('reconnect-failed');
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ [WebSocket] Ошибка соединения:', error);
        this.emit('error', error);
      };
      
    } catch (error) {
      console.error('❌ [WebSocket] Ошибка создания соединения:', error);
      this.emit('error', error);
    }
  }

  // Отправка сообщения
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('⚠️ [WebSocket] Соединение не установлено, сообщение не отправлено:', data);
    }
  }

  // Обработка входящих сообщений
  handleMessage(data) {
    switch (data.type) {
      case 'auth-success':
        console.log('✅ [WebSocket] Аутентификация успешна для пользователя:', data.userId);
        this.emit('auth-success', data);
        break;
        
      case 'chat-message':
        console.log('💬 [WebSocket] Новое сообщение чата:', data.message);
        this.emit('chat-message', data.message);
        break;
        
      case 'conversation-updated':
        console.log('📝 [WebSocket] Обновление диалога:', data.conversationId);
        this.emit('conversation-updated', data.conversationId);
        break;
        
      case 'messages-updated':
        console.log('📨 [WebSocket] Обновление сообщений');
        this.emit('messages-updated');
        break;
        
      case 'contacts-updated':
        console.log('👥 [WebSocket] Обновление контактов');
        this.emit('contacts-updated');
        break;
        
      case 'tags-updated':
        console.log('🏷️ [WebSocket] Обновление тегов клиентов');
        this.emit('tags-updated');
        break;
        
      case 'table-updated':
        console.log('[WebSocket] table-updated:', data.tableId);
        if (tableUpdateSubscribers[data.tableId]) {
          tableUpdateSubscribers[data.tableId].forEach(cb => cb(data));
        }
        break;
        
      default:
        console.log('❓ [WebSocket] Неизвестный тип сообщения:', data.type);
        this.emit('unknown-message', data);
    }
  }

  // Подписка на события
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Отписка от событий
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Эмиссия событий
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ [WebSocket] Ошибка в обработчике события ${event}:`, error);
        }
      });
    }
  }

  // Отключение
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.listeners.clear();
    console.log('🔌 [WebSocket] Отключен');
  }

  // Получение статуса соединения
  getStatus() {
    return {
      isConnected: this.isConnected,
      readyState: this.ws ? this.ws.readyState : null,
      reconnectAttempts: this.reconnectAttempts,
      userId: this.userId
    };
  }
}

// Создаем единственный экземпляр
const websocketService = new WebSocketService();

// Подписчики на обновления таблиц: tableId -> [callback]
const tableUpdateSubscribers = {};

function onTableUpdate(tableId, callback) {
  if (!tableUpdateSubscribers[tableId]) {
    tableUpdateSubscribers[tableId] = [];
  }
  tableUpdateSubscribers[tableId].push(callback);
  // Возвращаем функцию для отписки
  return () => {
    tableUpdateSubscribers[tableId] = tableUpdateSubscribers[tableId].filter(cb => cb !== callback);
  };
}

export default {
  websocketService,
  onTableUpdate,
}; 