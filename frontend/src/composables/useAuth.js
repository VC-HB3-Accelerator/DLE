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

import { ref, onMounted, onUnmounted, provide, inject } from 'vue';
import axios from '../api/axios';
import eventBus from '../utils/eventBus';

// === SINGLETON STATE ===
const isAuthenticated = ref(false);
const authType = ref(null);
const userId = ref(null);
const address = ref(null);
const telegramId = ref(null);
const email = ref(null);
const processedGuestIds = ref([]);
const identities = ref([]);
const tokenBalances = ref([]);
const userAccessLevel = ref({ level: 'guest', tokenCount: 0, hasAccess: false });

// Функция для обновления списка идентификаторов
const updateIdentities = async () => {
  if (!isAuthenticated.value || !userId.value) return;

  // Проверяем, что identities ref существует
  if (!identities || typeof identities.value === 'undefined') {
    console.warn('Identities ref is not initialized');
    return;
  }

  try {
    const response = await axios.get('/auth/identities');
    if (response.data.success) {
      // Фильтруем идентификаторы: убираем гостевые и оставляем только уникальные
      const filteredIdentities = response.data.identities
        .filter((identity) => identity.provider !== 'guest')
        .reduce((acc, identity) => {
          // Для каждого типа провайдера оставляем только один идентификатор
          const existingIdentity = acc.find((i) => i.provider === identity.provider);
          if (!existingIdentity) {
            acc.push(identity);
          }
          return acc;
        }, []);

      // Сравниваем новый отфильтрованный список с текущим значением
      const currentProviders = (identities.value || []).map(id => id?.provider || '').sort();
      const newProviders = (filteredIdentities || []).map(id => id?.provider || '').sort();
      
      const identitiesChanged = JSON.stringify(currentProviders) !== JSON.stringify(newProviders);

      // Обновляем реактивное значение с проверкой
      try {
        if (identities && identities.value !== undefined) {
          identities.value = filteredIdentities;
          console.log('User identities updated:', identities.value);
        } else {
          console.warn('Identities ref is not available or not initialized');
        }
      } catch (error) {
        console.error('Error updating identities:', error);
        // Если произошла ошибка, пытаемся инициализировать identities
        if (identities && typeof identities.value === 'undefined') {
          identities.value = [];
        }
      }

      // Если список идентификаторов изменился, принудительно проверяем аутентификацию,
      // чтобы обновить authType и другие связанные данные (например, telegramId)
      if (identitiesChanged) {
        console.log('Identities changed, forcing auth check.');
        await checkAuth(); // Вызываем checkAuth для обновления полного состояния
      }
    }
  } catch (error) {
    console.error('Error fetching user identities:', error);
  }
};

// Периодическое обновление идентификаторов
let identitiesInterval;

const startIdentitiesPolling = () => {
  if (identitiesInterval) return;
  identitiesInterval = setInterval(updateIdentities, 30000); // Обновляем каждые 30 секунд
};

const stopIdentitiesPolling = () => {
  if (identitiesInterval) {
    clearInterval(identitiesInterval);
    identitiesInterval = null;
  }
};

const checkTokenBalances = async (address) => {
  try {
    const response = await axios.get(`/auth/check-tokens/${address}`);
    if (response.data.success) {
      tokenBalances.value = response.data.data;
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('Error checking token balances:', error);
    return null;
  }
};

const checkUserAccessLevel = async (address) => {
  try {
    const response = await axios.get(`/auth/access-level/${address}`);
    if (response.data.success) {
      userAccessLevel.value = response.data.data;
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('Error checking user access level:', error);
    return null;
  }
};

const updateAuth = async ({
  authenticated,
  authType: newAuthType,
  userId: newUserId,
  address: newAddress,
  telegramId: newTelegramId,
  email: newEmail,
  userAccessLevel: newUserAccessLevel,
}) => {
  const wasAuthenticated = isAuthenticated.value;
  const previousUserId = userId.value;

  console.log('updateAuth called with:', {
    authenticated,
    newAuthType,
    newUserId,
    newAddress,
    newTelegramId,
    newEmail,
    newUserAccessLevel,
  });

  // Убедимся, что переменные являются реактивными
  isAuthenticated.value = authenticated === true;
  authType.value = newAuthType || null;
  userId.value = newUserId || null;
  address.value = newAddress || null;
  telegramId.value = newTelegramId || null;
  email.value = newEmail || null;
  
  // Обновляем userAccessLevel только если он изменился
  if (newUserAccessLevel) {
    // Используем userAccessLevel из ответа сервера
    console.log('[updateAuth] Setting userAccessLevel from server:', JSON.stringify(newUserAccessLevel, null, 2));
    userAccessLevel.value = newUserAccessLevel;
  } else if (authenticated && newAddress) {
    // Если userAccessLevel не передан, но пользователь аутентифицирован, запрашиваем его
    try {
      const accessLevel = await checkUserAccessLevel(newAddress);
      if (accessLevel && accessLevel.level !== userAccessLevel.value.level) {
        console.log('[updateAuth] Updating userAccessLevel from API:', accessLevel);
        userAccessLevel.value = accessLevel;
      }
    } catch (error) {
      console.error('Error updating userAccessLevel in updateAuth:', error);
    }
  } else if (!authenticated) {
    // Сбрасываем userAccessLevel для неавторизованных пользователей
    if (userAccessLevel.value.level !== 'guest') {
      console.log('[updateAuth] Resetting userAccessLevel to guest');
      userAccessLevel.value = { level: 'guest', tokenCount: 0, hasAccess: false };
    }
  }

  // Кэшируем данные аутентификации
  localStorage.setItem(
    'authData',
    JSON.stringify({
      authenticated,
      authType: newAuthType,
      userId: newUserId,
      address: newAddress,
      telegramId: newTelegramId,
      email: newEmail,
    })
  );

  // Если аутентификация через кошелек, проверяем баланс токенов и уровень доступа
  if (authenticated && newAuthType === 'wallet' && newAddress) {
    await checkTokenBalances(newAddress);
    await checkUserAccessLevel(newAddress);
  }

  // Обновляем идентификаторы при любом изменении аутентификации
  if (authenticated) {
    try {
      await updateIdentities();
      startIdentitiesPolling();
    } catch (error) {
      console.error('Error updating identities in updateAuth:', error);
    }
  } else {
    stopIdentitiesPolling();
    try {
      if (identities && typeof identities.value !== 'undefined') {
        identities.value = [];
      }
    } catch (error) {
      console.error('Error clearing identities:', error);
    }
  }

  console.log('Auth updated:', {
    authenticated: isAuthenticated.value,
    userId: userId.value,
    address: address.value,
    telegramId: telegramId.value,
    email: email.value,
  });
  
  // Уведомляем все компоненты об изменении состояния аутентификации
  // Только если состояние действительно изменилось
  if (wasAuthenticated !== isAuthenticated.value || previousUserId !== newUserId) {
    // Централизованная очистка данных при отключении
    if (!isAuthenticated.value && wasAuthenticated) {
      console.log('[useAuth] User logged out, clearing application data');
      // Очищаем глобальные данные приложения
      const event = new CustomEvent('clear-application-data');
      console.log('[useAuth] Dispatching clear-application-data event:', event);
      window.dispatchEvent(event);
    }
    
    // Централизованное обновление данных при подключении
    if (isAuthenticated.value && !wasAuthenticated) {
      console.log('[useAuth] User logged in, refreshing application data');
      window.dispatchEvent(new CustomEvent('refresh-application-data'));
    }
    
    // Отправляем событие через eventBus (централизованный подход)
    eventBus.emit('auth-state-changed', {
      authenticated: isAuthenticated.value,
      authType: authType.value,
      userId: userId.value,
      address: address.value,
      userAccessLevel: userAccessLevel.value
    });
  }

  // Если пользователь только что аутентифицировался или сменил аккаунт,
  // пробуем связать сообщения
  if (authenticated && (!wasAuthenticated || (previousUserId && previousUserId !== newUserId))) {
    console.log('Auth change detected, linking messages');
    linkMessages();
  }
};

// Функция для связывания сообщений после успешной авторизации
const linkMessages = async () => {
  try {
    if (isAuthenticated.value) {
      console.log('Linking messages after authentication');

      // Проверка, есть ли гостевой ID для обработки
      const localGuestId = localStorage.getItem('guestId');

      // Если гостевого ID нет или он уже был обработан, пропускаем запрос
      if (!localGuestId || processedGuestIds.value.includes(localGuestId)) {
        console.log('No new guest IDs to process or already processed');
        return {
          success: true,
          message: 'No new guest IDs to process',
          processedIds: processedGuestIds.value,
        };
      }

      // Создаем объект с идентификаторами для передачи на сервер
      const identifiersData = {
        userId: userId.value,
        guestId: localGuestId,
      };

      // Добавляем все доступные идентификаторы
      if (address.value) identifiersData.address = address.value;
      if (email.value) identifiersData.email = email.value;
      if (telegramId.value) identifiersData.telegramId = telegramId.value;

      console.log('Sending link-guest-messages request with data:', identifiersData);

      /* Удаляем ненужный вызов
      try {
        // Отправляем запрос на связывание сообщений
        const response = await axios.post('/auth/link-guest-messages', identifiersData);

        if (response.data.success) {
          console.log('Messages linked successfully:', response.data);

          // Обновляем список обработанных guestIds из ответа сервера
          if (response.data.processedIds && Array.isArray(response.data.processedIds)) {
            processedGuestIds.value = [...response.data.processedIds];
            console.log('Updated processed guest IDs from server:', processedGuestIds.value);
          }
          // В качестве запасного варианта также обрабатываем старый формат ответа
          else if (response.data.results && Array.isArray(response.data.results)) {
            const newProcessedIds = response.data.results
              .filter((result) => result.guestId)
              .map((result) => result.guestId);

            if (newProcessedIds.length > 0) {
              processedGuestIds.value = [
                ...new Set([...processedGuestIds.value, ...newProcessedIds]),
              ];
              console.log('Updated processed guest IDs from results:', processedGuestIds.value);
            }
          }

          // Очищаем гостевые сообщения из localStorage после успешного связывания
          localStorage.removeItem('guestMessages');
          localStorage.removeItem('guestId');

          return {
            success: true,
            processedIds: processedGuestIds.value,
          };
        }
      } catch (error) {
        console.error('Error linking messages:', error);
        return {
          success: false,
          error: error.message,
        };
      }
      */
      // Предполагаем, что бэкенд автоматически связывает сообщения
      // Очищаем данные гостя локально
      console.log('Assuming backend handles message linking. Clearing local guest data.');
      localStorage.removeItem('guestMessages');
      localStorage.removeItem('guestId');
      // Добавляем текущий guestId в обработанные, чтобы не пытаться отправить его снова
      if(localGuestId) {
        updateProcessedGuestIds([localGuestId]);
      }
      return { success: true, message: 'Local guest data cleared.' };

    }

    return { success: false, message: 'Not authenticated' };
  } catch (error) {
    console.error('Error in linkMessages:', error);
    return { success: false, error: error.message };
  }
};

const checkAuth = async () => {
  try {
    const response = await axios.get('/auth/check');
    console.log('Auth check response:', JSON.stringify(response.data, null, 2));

    const wasAuthenticated = isAuthenticated.value;
    const previousUserId = userId.value;
    const previousAuthType = authType.value;

    // Проверяем, изменилось ли состояние аутентификации
    const authChanged = (
      wasAuthenticated !== response.data.authenticated ||
      previousUserId !== response.data.userId ||
      previousAuthType !== response.data.authType
    );

    if (authChanged) {
      console.log('[checkAuth] Authentication state changed, updating...');
      // Обновляем данные авторизации через updateAuth вместо прямого изменения
      await updateAuth({
        authenticated: response.data.authenticated,
        authType: response.data.authType,
        userId: response.data.userId,
        address: response.data.address,
        telegramId: response.data.telegramId,
        email: response.data.email,
        userAccessLevel: response.data.userAccessLevel, // Добавляем userAccessLevel из ответа сервера
      });
    } else {
      console.log('[checkAuth] No authentication changes, skipping update');
    }

    // Если пользователь аутентифицирован, обновляем список идентификаторов и связываем сообщения
    if (response.data.authenticated) {
      // Сначала обновляем идентификаторы, чтобы иметь актуальные данные
      try {
        await updateIdentities();
      } catch (error) {
        console.error('Error updating identities in checkAuth:', error);
      }

      // Если пользователь только что аутентифицировался или сменил аккаунт,
      // связываем гостевые сообщения с его аккаунтом
      if (!wasAuthenticated || (previousUserId && previousUserId !== response.data.userId)) {
        // Немедленно связываем сообщения
        const linkResult = await linkMessages();
        console.log('Link messages result on auth change:', linkResult);

        // Если пользователь только что аутентифицировался через Telegram,
        // обновляем историю чата без перезагрузки страницы
        if (response.data.authType === 'telegram' && previousAuthType !== 'telegram') {
          console.log('Telegram auth detected, loading message history');
          // Отправляем событие для загрузки истории чата
          window.dispatchEvent(new CustomEvent('load-chat-history'));
        }
      }

      // Обновляем отображение подключенного состояния в UI
      updateConnectionDisplay(true, response.data.authType, response.data);
    } else {
      // Обновляем отображение отключенного состояния
      updateConnectionDisplay(false);
    }

    return response.data;
  } catch (error) {
    console.error('Error checking auth:', error);
    // В случае ошибки сбрасываем состояние аутентификации
    updateConnectionDisplay(false);
    return { authenticated: false };
  }
};

const disconnect = async () => {
  try {
    // Удаляем все идентификаторы перед выходом
    await axios.post('/auth/logout');

    // Обновляем состояние в памяти через updateAuth (это запустит централизованные события)
    await updateAuth({
      authenticated: false,
      authType: null,
      userId: null,
      address: null,
      telegramId: null,
      email: null,
    });

    // Обновляем отображение отключенного состояния
    updateConnectionDisplay(false);

    // Очищаем списки идентификаторов
    identities.value = [];
    processedGuestIds.value = [];

    // Очищаем localStorage полностью
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    localStorage.removeItem('address');
    localStorage.removeItem('guestId');
    localStorage.removeItem('guestMessages');
    localStorage.removeItem('telegramId');
    localStorage.removeItem('email');

    // Удаляем класс подключенного кошелька
    document.body.classList.remove('wallet-connected');

    console.log('User disconnected successfully and all identifiers cleared');

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting:', error);
    return { success: false, error: error.message };
  }
};

// Обновляем список обработанных guestIds
const updateProcessedGuestIds = (ids) => {
  if (Array.isArray(ids)) {
    processedGuestIds.value = [...new Set([...processedGuestIds.value, ...ids])].slice(-20);
  }
};

// Функция для обновления отображения подключения в UI
const updateConnectionDisplay = (isConnected, authType, authData = {}) => {
  try {
    console.log('Updating connection display:', { isConnected, authType, authData });

    if (isConnected) {
      document.body.classList.add('wallet-connected');

      const authDisplayEl = document.getElementById('auth-display');
      if (authDisplayEl) {
        let displayText = 'Подключено';

        if (authType === 'wallet' && authData.address) {
          const shortAddress = `${authData.address.substring(0, 6)}...${authData.address.substring(authData.address.length - 4)}`;
          displayText = `Кошелек: <strong>${shortAddress}</strong>`;
        } else if (authType === 'email' && authData.email) {
          displayText = `Email: <strong>${authData.email}</strong>`;
        } else if (authType === 'telegram' && authData.telegramId) {
          displayText = `Telegram: <strong>${authData.telegramUsername || authData.telegramId}</strong>`;
        }

        authDisplayEl.innerHTML = displayText;
        authDisplayEl.style.display = 'inline-block';
      }

      // Скрываем кнопки авторизации и показываем кнопку выхода
      const authButtonsEl = document.getElementById('auth-buttons');
      const logoutButtonEl = document.getElementById('logout-button');

      if (authButtonsEl) authButtonsEl.style.display = 'none';
      if (logoutButtonEl) logoutButtonEl.style.display = 'inline-block';
    } else {
      document.body.classList.remove('wallet-connected');

      // Скрываем отображение аутентификации
      const authDisplayEl = document.getElementById('auth-display');
      if (authDisplayEl) {
        authDisplayEl.style.display = 'none';
      }

      // Показываем кнопки авторизации и скрываем кнопку выхода
      const authButtonsEl = document.getElementById('auth-buttons');
      const logoutButtonEl = document.getElementById('logout-button');

      if (authButtonsEl) authButtonsEl.style.display = 'flex';
      if (logoutButtonEl) logoutButtonEl.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating connection display:', error);
  }
};

/**
 * Связывает новый идентификатор с текущим аккаунтом пользователя
 * @param {string} type - Тип идентификатора (wallet, email, telegram)
 * @param {string} value - Значение идентификатора
 * @returns {Promise<Object>} - Результат операции
 */
const linkIdentity = async (type, value) => {
  const response = await axios.post('/link', {
    type,
    value,
  });
  return response.data;
};

/**
 * Удаляет идентификатор пользователя
 * @param {string} provider - Тип идентификатора (wallet, email, telegram)
 * @param {string} providerId - Значение идентификатора
 * @returns {Promise<Object>} - Результат операции
 */
const deleteIdentity = async (provider, providerId) => {
  const response = await axios.delete(`/${provider}/${encodeURIComponent(providerId)}`);
  return response.data;
};

// === SINGLETON API ===
const authApi = {
  isAuthenticated,
  authType,
  userId,
  address,
  telegramId,
  email,
  identities,
  processedGuestIds,
  tokenBalances,
  userAccessLevel,
  updateAuth,
  checkAuth,
  disconnect,
  linkMessages,
  updateIdentities,
  updateProcessedGuestIds,
  updateConnectionDisplay,
  linkIdentity,
  deleteIdentity,
  checkTokenBalances,
  checkUserAccessLevel,
};

// === PROVIDE/INJECT HELPERS ===
const AUTH_KEY = Symbol('auth');

export function provideAuth() {
  provide(AUTH_KEY, authApi);
}

export function useAuthContext() {
  const ctx = inject(AUTH_KEY);
  if (!ctx) throw new Error('Auth context not provided!');
  return ctx;
}

// === useAuth теперь просто возвращает singleton ===
export function useAuth() {
  onMounted(async () => {
    await checkAuth();
  });
  onUnmounted(() => {
    stopIdentitiesPolling();
  });
  return authApi;
}
