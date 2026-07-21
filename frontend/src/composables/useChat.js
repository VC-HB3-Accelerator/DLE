/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import api from '../api/axios';
import { getFromStorage, setToStorage, removeFromStorage } from '../utils/storage';
import { generateUniqueId } from '../utils/helpers';
import websocketModule from '../services/websocketService';
import { i18n } from '@/locales/index.js';

const t = (key, params) => i18n.global.t(key, params);

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
                // Получаем количество личных сообщений с ИИ
                const personalCountResponse = await api.get('/chat/history', { params: { count_only: true } });
                // Offset только по личному /chat/history — нельзя складывать с public
                // (иначе offset «перепрыгивает» личные сообщения и главная пустая)
                const personalCount = personalCountResponse.data.success
                  ? (personalCountResponse.data.total ?? personalCountResponse.data.count ?? 0)
                  : 0;
                totalMessages = personalCount;
                // console.log(`[useChat] Всего сообщений в истории: ${totalMessages} (личные: ${personalCount}, публичные: ${publicCount})`);
             } catch(countError) {
                 // console.error('[useChat] Ошибка получения количества сообщений:', countError);
                 // Не прерываем выполнение, попробуем загрузить без total
             }
        }

        // API отдаёт newest-first (ORDER BY created_at DESC). Первая загрузка — offset 0.
        let effectiveOffset = initial ? 0 : messageLoading.value.offset;

        // Загружаем личные сообщения с ИИ
        const personalResponse = await api.get('/chat/history', { 
            params: { 
                offset: effectiveOffset, 
                limit: messageLoading.value.limit 
            } 
        });
        
        const response = {
            data: personalResponse.data
        };

        if (response.data.success && response.data.messages) {
            const loadedMessages = response.data.messages;
            const totalFromResponse = response.data.total;
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
                if (initial && totalFromResponse > 0 && effectiveOffset > 0) {
                   messageLoading.value.offset = effectiveOffset + loadedMessages.length;
                } else {
                   messageLoading.value.offset += loadedMessages.length;
                }
                 // console.log(`[useChat] Новое смещение: ${messageLoading.value.offset}`);

                // Проверяем, есть ли еще сообщения для загрузки
                // Используем totalFromResponse из нового API
                if (totalFromResponse >= 0) {
                     messageLoading.value.hasMoreMessages = messageLoading.value.offset < totalFromResponse;
                } else {
                    // Если total не известен, используем hasMore из ответа
                     messageLoading.value.hasMoreMessages = response.data.hasMore || false;
                }
                 // console.log(`[useChat] Есть еще сообщения: ${messageLoading.value.hasMoreMessages}`);
            } else {
                // Если сообщений не пришло, значит, больше нет
                messageLoading.value.hasMoreMessages = false;
            }

            // guestId чистим только после process-guest (linkGuestMessagesAfterAuth / useAuth.linkMessages)
            if (authType) {
                removeFromStorage('guestMessages');
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
        content: userMessageContent || t('chat.attachmentsCount', { count: files.length }),
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
            // Системное сообщение о согласиях уже включено в ответ ИИ
            let guestAiForStorage = null;
            if (response.data.aiResponse) {
                const suggestWalletLogin = Boolean(
                    response.data.suggestWalletLogin
                    || response.data.aiResponse.suggestWalletLogin
                );
                const aiMessage = {
                    id: `ai_${Date.now()}`,
                    content: response.data.aiResponse.response || response.data.aiResponse,
                    sender_type: 'assistant',
                    role: 'assistant',
                    timestamp: new Date().toISOString(),
                    isLocal: false,
                    isGuest: isGuestMessage,
                    suggestWalletLogin,
                    // Добавляем информацию о согласиях, если есть
                    consentRequired: response.data.consentRequired || false,
                    missingConsents: response.data.missingConsents || [],
                    consentDocuments: response.data.consentDocuments || [],
                    autoConsentOnReply: response.data.autoConsentOnReply || false
                };
                messages.value.push(aiMessage);

                if (isGuestMessage) {
                    guestAiForStorage = {
                        id: aiMessage.id,
                        content: aiMessage.content,
                        sender_type: 'assistant',
                        role: 'assistant',
                        isGuest: true,
                        suggestWalletLogin,
                        timestamp: aiMessage.timestamp
                    };
                }
            }

            // Добавляем системное сообщение для гостя (только если нет согласия, чтобы не дублировать)
            if (isGuestMessage && response.data.systemMessage && !response.data.consentRequired) {
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

            // Сохраняем гостевые сообщения (user → ai) в localStorage
            if (isGuestMessage && userMsgIndex !== -1) {
                try {
                    const storedMessages = getFromStorage('guestMessages', []);
                    storedMessages.push({
                        id: messages.value[userMsgIndex].id,
                        content: userMessageContent,
                        sender_type: 'user',
                        role: 'user',
                        isGuest: true,
                        timestamp: messages.value[userMsgIndex].timestamp,
                        attachmentsInfo: messages.value[userMsgIndex].attachments
                    });
                    if (guestAiForStorage) {
                        storedMessages.push(guestAiForStorage);
                    }
                    setToStorage('guestMessages', storedMessages);
                } catch (storageError) {
                    // console.error('[useChat] Ошибка сохранения гостевого сообщения в localStorage:', storageError);
                }
            }

            hasUserSentMessage.value = true;
            setToStorage('hasUserSentMessage', true);

        } else {
            throw new Error(response.data.error || t('chat.sendApiError'));
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
            content: t('chat.sendMessageError'),
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
    const id = guestId.value || getFromStorage('guestId', '');
    if (!id) return { success: false, skipped: true };
    try {
      const response = await api.post('/chat/process-guest', { guestId: id });
      if (response.data.success) {
        removeFromStorage('guestId');
        removeFromStorage('guestMessages');
        guestId.value = '';
        return {
          success: true,
          migratedMessages: response.data.migratedMessages || 0,
          conversationId: response.data.conversationId || null
        };
      }
      return { success: false, error: response.data?.error };
    } catch (error) {
      return { success: false, error: error?.message || 'process-guest failed' };
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

 // userId появляется после checkAuth — тогда и цепляем WS
 watch(() => auth.userId?.value, (uid) => {
     if (uid && auth.isAuthenticated.value) {
         setupChatWebSocket();
     }
 }, { immediate: false });

  // --- WebSocket для real-time сообщений ---
  function setupChatWebSocket() {
    const uid = auth.userId?.value ?? auth.user?.value?.id ?? null;
    if (!auth.isAuthenticated.value || !uid) return;

    // Снять прошлые handlers — иначе при повторном setup дубли в ленте
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
    if (wsCallbacks.messagesUpdated) {
      websocketService.off('messages-updated', wsCallbacks.messagesUpdated);
    }

    websocketService.connect(uid);

    wsCallbacks.chatMessage = (message) => {
      const existingMessage = messages.value.find((m) => m.id === message.id);
      if (!existingMessage) {
        messages.value.push(message);
      }
    };
    wsCallbacks.conversationUpdated = () => {};
    wsCallbacks.connected = () => {};
    wsCallbacks.disconnected = () => {};
    wsCallbacks.error = () => {};
    wsCallbacks.messagesUpdated = () => {
      if (!messages.value.length) {
        loadMessages({ initial: true });
      }
    };

    websocketService.on('chat-message', wsCallbacks.chatMessage);
    websocketService.on('conversation-updated', wsCallbacks.conversationUpdated);
    websocketService.on('connected', wsCallbacks.connected);
    websocketService.on('disconnected', wsCallbacks.disconnected);
    websocketService.on('error', wsCallbacks.error);
    websocketService.on('messages-updated', wsCallbacks.messagesUpdated);
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
      if (wsCallbacks.messagesUpdated) {
        websocketService.off('messages-updated', wsCallbacks.messagesUpdated);
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
    
    // Логика обновления данных централизована в useAuth.js
  });
  
  onUnmounted(() => {
    cleanupWebSocket();
  });

    // Подписываемся на централизованные события очистки и обновления данных
    window.addEventListener('clear-application-data', () => {
      console.log('[useChat] Clearing chat data');
      // Очищаем данные при выходе из системы
      messages.value = [];
    });
    
    window.addEventListener('refresh-application-data', () => {
      console.log('[useChat] Refreshing chat data');
      loadMessages({ initial: true }); // Обновляем данные при входе в систему
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