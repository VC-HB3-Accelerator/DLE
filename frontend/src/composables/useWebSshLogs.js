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

import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Композабл для real-time логов WebSSH агента
 */
export function useWebSshLogs() {
  const logs = ref([]);
  const isConnected = ref(false);
  const isListening = ref(false);
  const maxLogs = 1000; // Максимальное количество логов в памяти
  let ws = null;

  // Добавление нового лога
  const addLog = (type, message, timestamp = new Date()) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      type, // 'info', 'success', 'error', 'warning', 'debug'
      message,
      timestamp
    };

    logs.value.push(logEntry);

    // Ограничиваем количество логов в памяти
    if (logs.value.length > maxLogs) {
      logs.value = logs.value.slice(-maxLogs);
    }

    // Автоматическая прокрутка к последнему логу
    setTimeout(() => {
      const logContainer = document.querySelector('.log-container');
      if (logContainer) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }, 100);
  };

  // Обработчик WebSocket сообщений
  const handleWebSshLog = (data) => {
    console.log('[WebSSH Logs] Получен лог:', data);
    
    if (data.type === 'webssh_log') {
      addLog(data.logType || 'info', data.message, new Date(data.timestamp || Date.now()));
    }
  };

  // Обработчик WebSocket сообщений о статусе агента
  const handleWebSshStatus = (data) => {
    console.log('[WebSSH Logs] Получен статус:', data);
    
    if (data.type === 'webssh_status') {
      isConnected.value = data.connected;
      
      if (data.message) {
        addLog(data.status === 'connected' ? 'success' : 'error', data.message);
      }
    }
  };

  // Обработчик WebSocket сообщений о прогрессе
  const handleWebSshProgress = (data) => {
    console.log('[WebSSH Logs] Получен прогресс:', data);
    
    if (data.type === 'webssh_progress') {
      const hasPercentage = data.percentage !== undefined && data.percentage !== null;
      const progressSuffix = hasPercentage ? ` — ${data.percentage}%` : '';
      const progressMessage = `[${data.stage}] ${data.message}${progressSuffix}`;
      addLog('info', progressMessage);
    }
  };

  // Начать прослушивание логов
  const startListening = () => {
    if (isListening.value) return;
    
    console.log('[WebSSH Logs] Начинаем прослушивание логов...');
    
    try {
      // Подключаемся к WebSSH Agent WebSocket
      // Всегда используем localhost:3000, так как порт проброшен в Docker
      const wsUrl = 'ws://localhost:3000';
      
      console.log('[WebSSH Logs] Подключение к:', wsUrl);
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WebSSH Logs] Подключено к WebSSH Agent');
        isConnected.value = true;
        addLog('success', 'Подключено к WebSSH Agent');
      };
      
      ws.onclose = () => {
        console.log('[WebSSH Logs] Отключено от WebSSH Agent');
        isConnected.value = false;
        addLog('warning', 'Отключено от WebSSH Agent');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Обрабатываем разные типы сообщений
          switch (data.type) {
            case 'webssh_log':
              handleWebSshLog(data);
              break;
            case 'webssh_status':
              handleWebSshStatus(data);
              break;
            case 'webssh_progress':
              handleWebSshProgress(data);
              break;
            default:
              console.log('[WebSSH Logs] Неизвестный тип сообщения:', data.type);
          }
        } catch (error) {
          console.error('[WebSSH Logs] Ошибка парсинга сообщения:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[WebSSH Logs] Ошибка WebSocket:', error);
        addLog('error', 'Ошибка подключения к WebSSH Agent');
      };
      
      isListening.value = true;
      addLog('info', 'Подключение к WebSSH логам...');
    } catch (error) {
      console.error('[WebSSH Logs] Ошибка создания WebSocket:', error);
      addLog('error', 'Не удалось подключиться к WebSSH Agent');
    }
  };

  // Остановить прослушивание логов
  const stopListening = () => {
    if (!isListening.value) return;
    
    console.log('[WebSSH Logs] Останавливаем прослушивание логов...');
    
    // Отключаемся от WebSSH Agent
    if (ws) {
      ws.close();
      ws = null;
    }
    
    isListening.value = false;
    isConnected.value = false;
    addLog('info', 'Отключение от WebSSH логов');
  };

  // Очистить логи
  const clearLogs = () => {
    logs.value = [];
    addLog('info', 'Логи очищены');
  };

  // Форматирование времени
  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Получить цвет для типа лога
  const getLogColor = (type) => {
    switch (type) {
      case 'success': return '#27ae60';
      case 'error': return '#e74c3c';
      case 'warning': return '#f39c12';
      case 'debug': return '#95a5a6';
      default: return '#3498db';
    }
  };

  // Получить иконку для типа лога
  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  };

  // Автоматическое подключение при монтировании компонента
  onMounted(() => {
    startListening();
  });

  // Автоматическое отключение при размонтировании компонента
  onUnmounted(() => {
    stopListening();
  });

  return {
    logs,
    isConnected,
    isListening,
    addLog,
    startListening,
    stopListening,
    clearLogs,
    formatTime,
    getLogColor,
    getLogIcon
  };
}
