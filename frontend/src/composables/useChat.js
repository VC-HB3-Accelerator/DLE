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

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import api from '../api/axios';
import { getFromStorage, setToStorage, removeFromStorage } from '../utils/storage';
import { generateUniqueId } from '../utils/helpers';
import websocketModule from '../services/websocketService';

const { websocketService } = websocketModule;

function initGuestId() {
  let id = getFromStorage('guestId', '');
  if (!id) {
    id = generateUniqueId();
    setToStorage('guestId', id);
  }
  return id;
}

export function useChat(auth) {
  const messages = ref([]);
  const newMessage = ref('');
  const attachments = ref([]); // Теперь это массив File объектов
  const userLanguage = ref('ru');
  const isLoading = ref(false); // Общая загрузка (например, при отправке)
  const hasUserSentMessage = ref(getFromStorage('hasUserSentMessage') === true);

  const messageLoading = ref({
    isLoadingHistory: false, // Загрузка истории
    hasMoreMessages: false,
    offset: 0,
    limit: 30,
    isHistoryLoadingInProgress: false, // Флаг для предотвращения параллельных запросов истории
    isLinkingGuest: false, // Флаг для процесса связывания гостевых сообщений (пока не используется активно)
  });

  const guestId = ref(initGuestId());

  // Сохраняем ссылки на callback функции WebSocket для правильной отписки
  const wsCallbacks = {
    chatMessage: null,
    conversationUpdated: null,
    connected: null,
    disconnected: null,
    error: null
  };

  const shouldLoadHistory = computed(() => {
    return auth.isAuthenticated.value || !!guestId.value;
  });

  // --- Загрузка истории --- 
  const loadMessages = async (options = {}) => {
    const { silent = false, initial = false, authType = null } = options;

    if (messageLoading.value.isHistoryLoadingInProgress) {
      // console.warn('[useChat] Загрузка истории уже идет, пропуск.');
      return;
    }
    messageLoading.value.isHistoryLoadingInProgress = true;

    // Если initial=true, сбрасываем offset и hasMoreMessages
    if (initial) {
        // console.log('[useChat] Начальная загрузка истории...');
        messageLoading.value.offset = 0;
        messageLoading.value.hasMoreMessages = false;
        messages.value = []; // Очищаем текущие сообщения перед начальной загрузкой
    }

    // Не загружаем больше, если уже грузим или больше нет
    if (!initial && (!messageLoading.value.hasMoreMessages || messageLoading.value.isLoadingHistory)) {
      messageLoading.value.isHistoryLoadingInProgress = false;
      return;
    }

    messageLoading.value.isLoadingHistory = true;
    if (!silent && initial) isLoading.value = true; // Показываем общий лоадер только при начальной загрузке

    // console.log(
    //   `[useChat] Загрузка истории сообщений (initial: ${initial}, authType: ${authType}, offset: ${messageLoading.value.offset})...`
    // );

    try {
        // --- Логика ожидания привязки гостя (упрощенная) --- 
        // TODO: Рассмотреть более надежный механизм, если это необходимо
        if (authType) {
            // console.log(`[useChat] Ожидание после ${authType} аутентификации...`);
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Увеличена задержка
            // console.log('[useChat] Ожидание завершено, продолжаем загрузку истории.');
        }
        // --- Конец логики ожидания --- 

        // Определяем, нужно ли запрашивать count
        let totalMessages = -1;
        if (initial || messageLoading.value.offset === 0) {
             try {
                const countResponse = await api.get('/chat/history', { params: { count_only: true } });
                if (!countResponse.data.success) throw new Error('Не удалось получить количество сообщений');
                totalMessages = countResponse.data.total || countResponse.data.count || 0;
                // console.log(`[useChat] Всего сообщений в истории: ${totalMessages}`);
             } catch(countError) {
                 // console.error('[useChat] Ошибка получения количества сообщений:', countError);
                 // Не прерываем выполнение, попробуем загрузить без total
             }
        }

        let effectiveOffset = messageLoading.value.offset;
        // Если это первая загрузка и мы знаем total, рассчитаем смещение для последних сообщений
        if (initial && totalMessages > 0 && totalMessages > messageLoading.value.limit) {
            effectiveOffset = Math.max(0, totalMessages - messageLoading.value.limit);
            // console.log(`[useChat] Рассчитано начальное смещение: ${effectiveOffset}`);
        }

        const response = await api.get('/chat/history', {
            params: {
                offset: effectiveOffset,
                limit: messageLoading.value.limit,
            },
        });

        if (response.data.success) {
            const loadedMessages = response.data.messages || [];
            // console.log(`[useChat] Загружено ${loadedMessages.length} сообщений.`);

            if (loadedMessages.length > 0) {
                // Добавляем к существующим (в начало для истории, в конец для начальной загрузки)
                 if (initial) {
                    messages.value = loadedMessages;
                 } else {
                    messages.value = [...loadedMessages, ...messages.value];
                 }
                
                // Обновляем смещение для следующей загрузки
                // Если загружали последние, offset = total - limit + loaded
                if (initial && totalMessages > 0 && effectiveOffset > 0) {
                   messageLoading.value.offset = effectiveOffset + loadedMessages.length;
                } else {
                   messageLoading.value.offset += loadedMessages.length;
                }
                 // console.log(`[useChat] Новое смещение: ${messageLoading.value.offset}`);

                // Проверяем, есть ли еще сообщения для загрузки
                // Используем totalMessages, если он был успешно получен
                if (totalMessages >= 0) {
                     messageLoading.value.hasMoreMessages = messageLoading.value.offset < totalMessages;
                } else {
                    // Если total не известен, считаем, что есть еще, если загрузили полный лимит
                     messageLoading.value.hasMoreMessages = loadedMessages.length === messageLoading.value.limit;
                }
                 // console.log(`[useChat] Есть еще сообщения: ${messageLoading.value.hasMoreMessages}`);
            } else {
                // Если сообщений не пришло, значит, больше нет
                messageLoading.value.hasMoreMessages = false;
            }

            // Очищаем гостевые данные после успешной аутентификации и загрузки
            if (authType) {
                removeFromStorage('guestMessages');
                // removeFromStorage('guestId'); // Удаление guestId теперь только после успешного связывания
                guestId.value = '';
            }

            // Считаем, что пользователь отправлял сообщение, если история не пуста
            if (messages.value.length > 0) {
                hasUserSentMessage.value = true;
                setToStorage('hasUserSentMessage', true);
            }

        } else {
            // console.error('[useChat] API вернул ошибку при загрузке истории:', response.data.error);
             messageLoading.value.hasMoreMessages = false; // Считаем, что больше нет при ошибке
        }
    } catch (error) {
      // console.error('[useChat] Ошибка загрузки истории сообщений:', error);
      messageLoading.value.hasMoreMessages = false; // Считаем, что больше нет при ошибке
    } finally {
      messageLoading.value.isLoadingHistory = false;
      messageLoading.value.isHistoryLoadingInProgress = false;
      if (initial) isLoading.value = false;
    }
  };

  // --- Отправка сообщения --- 
  const handleSendMessage = async (payload) => {
    // --- НАЧАЛО ДОБАВЛЕННЫХ ЛОГОВ ---
    // console.log('[useChat] handleSendMessage called. Payload:', payload);
    // console.log('[useChat] Current auth state:', {
    //     isAuthenticated: auth.isAuthenticated.value,
    //     userId: auth.userId.value,
    //     authType: auth.authType.value,
    // });
    // --- КОНЕЦ ДОБАВЛЕННЫХ ЛОГОВ ---

    const { message: text, attachments: files } = payload; // files - массив File объектов
    const userMessageContent = text.trim();

    // Проверка на пустое сообщение (если нет ни текста, ни файлов)
    if (!userMessageContent && (!files || files.length === 0)) {
        // console.warn('[useChat] Попытка отправить пустое сообщение.');
        return;
    }

    isLoading.value = true;
    const tempId = generateUniqueId();
    const isGuestMessage = !auth.isAuthenticated.value;

    // Создаем локальное сообщение для отображения
    const userMessage = {
        id: tempId,
        content: userMessageContent || `[${files.length} вложений]`, // Отображение для UI
        sender_type: 'user',
        role: 'user',
        isLocal: true,
        isGuest: isGuestMessage,
        timestamp: new Date().toISOString(),
        // Генерируем инфо для отображения в Message.vue (без File объектов)
        attachments: files ? files.map(f => ({ 
            originalname: f.name,
            size: f.size,
            mimetype: f.type,
            // url: URL.createObjectURL(f) // Можно создать временный URL для превью, если Message.vue его использует
        })) : [],
        hasError: false
    };
    messages.value.push(userMessage);

    // Очистка ввода происходит в ChatInterface
    // newMessage.value = '';
    // attachments.value = [];

    try {
        const formData = new FormData();
        formData.append('message', userMessageContent);
        formData.append('language', userLanguage.value);

        if (files && files.length > 0) {
            files.forEach((file) => {
                formData.append('attachments', file, file.name);
            });
        }

        let apiUrl = '/chat/message';
        if (isGuestMessage) {
            if (!guestId.value) {
                guestId.value = initGuestId();
                setToStorage('guestId', guestId.value);
            }
            formData.append('guestId', guestId.value);
            apiUrl = '/chat/guest-message';
        }

        const response = await api.post(apiUrl, formData, {
            headers: {
                // Content-Type устанавливается браузером для FormData
            }
        });

        const userMsgIndex = messages.value.findIndex((m) => m.id === tempId);

        if (response.data.success) {
             // console.log('[useChat] Сообщение успешно отправлено:', response.data);
             // Обновляем локальное сообщение данными с сервера
             if (userMsgIndex !== -1) {
                const serverUserMessage = response.data.userMessage || { id: response.data.messageId };
                messages.value[userMsgIndex].id = serverUserMessage.id || tempId; // Используем серверный ID
                messages.value[userMsgIndex].isLocal = false;
                messages.value[userMsgIndex].timestamp = serverUserMessage.created_at || new Date().toISOString();
                // Опционально: обновить content/attachments с сервера, если они отличаются
             }

            // Добавляем ответ ИИ, если есть
            if (response.data.aiMessage) {
                messages.value.push({
                    ...response.data.aiMessage,
                    sender_type: 'assistant', // Убедимся, что тип правильный
                    role: 'assistant',
                });
            }

            // Добавляем системное сообщение для гостя (только на клиенте, не сохраняется в истории)
            if (isGuestMessage && response.data.systemMessage) {
                messages.value.push({
                    id: `system-${Date.now()}`,
                    content: response.data.systemMessage,
                    sender_type: 'system',
                    role: 'system',
                    timestamp: new Date().toISOString(),
                    isSystem: true,
                    telegramBotUrl: response.data.telegramBotUrl,
                    supportEmail: response.data.supportEmail
                });
            }

            // Сохраняем гостевое сообщение (если нужно)
            if (isGuestMessage) {
                try {
                    const storedMessages = getFromStorage('guestMessages', []);
                    // Добавляем сообщение пользователя (с серверным ID)
                    storedMessages.push({
                        id: messages.value[userMsgIndex].id,
                        content: userMessageContent,
                        sender_type: 'user',
                        role: 'user',
                        isGuest: true,
                        timestamp: messages.value[userMsgIndex].timestamp,
                        attachmentsInfo: messages.value[userMsgIndex].attachments // Сохраняем инфо о файлах
                    });
                    setToStorage('guestMessages', storedMessages);
                } catch (storageError) {
                    // console.error('[useChat] Ошибка сохранения гостевого сообщения в localStorage:', storageError);
                }
            }

            hasUserSentMessage.value = true;
            setToStorage('hasUserSentMessage', true);

        } else {
            throw new Error(response.data.error || 'Ошибка отправки сообщения от API');
        }

    } catch (error) {
        // console.error('[useChat] Ошибка отправки сообщения:', error);
        const userMsgIndex = messages.value.findIndex((m) => m.id === tempId);
        if (userMsgIndex !== -1) {
            messages.value[userMsgIndex].hasError = true;
            messages.value[userMsgIndex].isLocal = false; // Убираем статус "отправка"
        }
        // Добавляем системное сообщение об ошибке
        messages.value.push({
            id: `error-${Date.now()}`,
            content: 'Произошла ошибка при отправке сообщения. Пожалуйста, попробуйте еще раз.',
            sender_type: 'system',
            role: 'system',
            timestamp: new Date().toISOString(),
        });
    } finally {
        isLoading.value = false;
    }
  };

  // --- Управление гостевыми сообщениями --- 
  const loadGuestMessagesFromStorage = () => {
      if (!auth.isAuthenticated.value && guestId.value) {
          try {
              const storedMessages = getFromStorage('guestMessages');
              if (storedMessages && Array.isArray(storedMessages) && storedMessages.length > 0) {
                  // console.log(`[useChat] Найдено ${storedMessages.length} сохраненных гостевых сообщений`);
                  // Добавляем только если текущий список пуст (чтобы не дублировать при HMR)
                  if(messages.value.length === 0) {
                     messages.value = storedMessages.map(m => ({ ...m, isGuest: true })); // Помечаем как гостевые
                     hasUserSentMessage.value = true;
                  }
              }
          } catch (e) {
              // console.error('[useChat] Ошибка загрузки гостевых сообщений из localStorage:', e);
              removeFromStorage('guestMessages'); // Очистить при ошибке парсинга
          }
      }
  };

  // --- Связывание гостевых сообщений после аутентификации ---
  const linkGuestMessagesAfterAuth = async () => {
    if (!guestId.value) return;
    try {
      const response = await api.post('/chat/process-guest', { guestId: guestId.value });
      if (response.data.success && response.data.conversationId) {
        // Можно сразу загрузить историю по этому диалогу, если нужно
        await loadMessages({ initial: true });
        // Удаляем guestId только после успешного связывания
        removeFromStorage('guestId');
        guestId.value = '';
      }
    } catch (error) {
      // console.error('[useChat] Ошибка связывания гостевых сообщений:', error);
      }
  };

  // --- Watchers --- 
  // Сортировка сообщений при изменении
  watch(messages, (newMessages) => {
    // Сортируем только если массив изменился
    if (newMessages.length > 1) {
       messages.value.sort((a, b) => {
         const dateA = new Date(a.timestamp || a.created_at || 0);
         const dateB = new Date(b.timestamp || b.created_at || 0);
         return dateA - dateB;
       });
    }
  }, { deep: false }); // deep: false т.к. нас интересует только добавление/удаление элементов

 // Сброс чата при выходе пользователя
 watch(() => auth.isAuthenticated.value, (isAuth, wasAuth) => {
     if (!isAuth && wasAuth) { // Если пользователь разлогинился
         // console.log('[useChat] Пользователь вышел, сброс состояния чата.');
         messages.value = [];
         messageLoading.value.offset = 0;
         messageLoading.value.hasMoreMessages = false;
         hasUserSentMessage.value = false;
         newMessage.value = '';
         attachments.value = [];
         // Отключаем WebSocket
         cleanupWebSocket();
         // Гостевые данные очищаются при успешной аутентификации в loadMessages
         // или если пользователь сам очистит localStorage
     } else if (isAuth && !wasAuth) { // Если пользователь вошел
         // console.log('[useChat] Пользователь вошел, подключаем WebSocket.');
         // Отложенное подключение, чтобы дождаться загрузки данных пользователя
         setTimeout(() => setupChatWebSocket(), 100);
     }
 });

 // Отслеживаем загрузку данных пользователя для подключения WebSocket
 watch(() => auth.user?.value, (newUser, oldUser) => {
     if (newUser && newUser.id && auth.isAuthenticated.value) {
         // console.log('[useChat] Данные пользователя загружены, подключаем WebSocket:', newUser.id);
         setupChatWebSocket();
     }
 }, { immediate: false });

  // --- WebSocket для real-time сообщений ---
  function setupChatWebSocket() {
    // Подключаемся к WebSocket только если пользователь аутентифицирован
    if (auth.isAuthenticated.value && auth.user && auth.user.value && auth.user.value.id) {
      // console.log('[useChat] Подключение к WebSocket для пользователя:', auth.user.value.id);
      websocketService.connect(auth.user.value.id);
      
      // Создаем и сохраняем callback функции
      wsCallbacks.chatMessage = (message) => {
        // console.log('[useChat] Получено новое сообщение через WebSocket:', message);
        // Проверяем, что сообщение не дублируется
        const existingMessage = messages.value.find(m => m.id === message.id);
        if (!existingMessage) {
          messages.value.push(message);
        }
      };
      
      wsCallbacks.conversationUpdated = (conversationId) => {
        // console.log('[useChat] Обновление диалога через WebSocket:', conversationId);
        // Можно добавить логику обновления списка диалогов
      };
      
      wsCallbacks.connected = () => {
        // console.log('[useChat] WebSocket подключен');
      };
      
      wsCallbacks.disconnected = () => {
        // console.log('[useChat] WebSocket отключен');
      };
      
      wsCallbacks.error = (error) => {
        // console.error('[useChat] WebSocket ошибка:', error);
      };
      
      // Подписываемся на события
      websocketService.on('chat-message', wsCallbacks.chatMessage);
      websocketService.on('conversation-updated', wsCallbacks.conversationUpdated);
      websocketService.on('connected', wsCallbacks.connected);
      websocketService.on('disconnected', wsCallbacks.disconnected);
      websocketService.on('error', wsCallbacks.error);
    } else {
      // console.log('[useChat] WebSocket не подключен: пользователь не аутентифицирован или данные не загружены');
    }
  }
  
  function cleanupWebSocket() {
    // Отписываемся от всех событий, передавая те же callback функции
    if (websocketService) {
      if (wsCallbacks.chatMessage) {
        websocketService.off('chat-message', wsCallbacks.chatMessage);
      }
      if (wsCallbacks.conversationUpdated) {
        websocketService.off('conversation-updated', wsCallbacks.conversationUpdated);
      }
      if (wsCallbacks.connected) {
        websocketService.off('connected', wsCallbacks.connected);
      }
      if (wsCallbacks.disconnected) {
        websocketService.off('disconnected', wsCallbacks.disconnected);
      }
      if (wsCallbacks.error) {
        websocketService.off('error', wsCallbacks.error);
      }
      websocketService.disconnect();
      
      // Очищаем ссылки на callback функции
      Object.keys(wsCallbacks).forEach(key => {
        wsCallbacks[key] = null;
      });
    }
  }

  // --- Инициализация --- 
  onMounted(() => {
    if (!auth.isAuthenticated.value && guestId.value) {
      loadGuestMessagesFromStorage();
    } else if (auth.isAuthenticated.value) {
      loadMessages({ initial: true });
    }
    
    // Подключаем WebSocket если пользователь уже аутентифицирован
    setupChatWebSocket();
  });
  
  onUnmounted(() => {
    cleanupWebSocket();
  });

  return {
    messages,
    newMessage,     // v-model
    attachments,    // v-model
    isLoading,
    messageLoading, // Содержит isLoadingHistory и hasMoreMessages
    userLanguage,
    hasUserSentMessage,
    loadMessages,
    handleSendMessage,
    loadGuestMessagesFromStorage, // Экспортируем на всякий случай
    linkGuestMessagesAfterAuth,   // Экспортируем для вызова после авторизации
  };
} 