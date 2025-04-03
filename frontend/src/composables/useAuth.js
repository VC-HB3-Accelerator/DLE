import { ref, onMounted } from 'vue';
import axios from '../api/axios';

export function useAuth() {
  const isAuthenticated = ref(false);
  const authType = ref(null);
  const userId = ref(null);
  const address = ref(null);
  const telegramId = ref(null);
  const isAdmin = ref(false);
  const email = ref(null);
  const processedGuestIds = ref([]);
  const identities = ref([]);
  
  // Функция для обновления списка идентификаторов
  const updateIdentities = async () => {
    if (!isAuthenticated.value || !userId.value) return;
    
    try {
      const response = await axios.get('/api/auth/identities');
      if (response.data.success) {
        identities.value = response.data.identities;
        console.log('User identities updated:', identities.value);
      }
    } catch (error) {
      console.error('Error fetching user identities:', error);
    }
  };
  
  const updateAuth = ({ authenticated, authType: newAuthType, userId: newUserId, address: newAddress, telegramId: newTelegramId, isAdmin: newIsAdmin, email: newEmail }) => {
    const wasAuthenticated = isAuthenticated.value;
    const previousUserId = userId.value;
    
    console.log('updateAuth called with:', { 
      authenticated, 
      newAuthType, 
      newUserId, 
      newAddress, 
      newTelegramId, 
      newIsAdmin, 
      newEmail 
    });
    
    // Убедимся, что переменные являются реактивными
    isAuthenticated.value = authenticated === true;
    authType.value = newAuthType || null;
    userId.value = newUserId || null;
    address.value = newAddress || null;
    telegramId.value = newTelegramId || null;
    isAdmin.value = newIsAdmin === true;
    email.value = newEmail || null;
    
    console.log('Auth updated:', { 
      authenticated: isAuthenticated.value,
      userId: userId.value,
      address: address.value,
      telegramId: telegramId.value, 
      email: email.value,
      isAdmin: isAdmin.value
    });
    
    // Если пользователь только что аутентифицировался или сменил аккаунт, 
    // пробуем связать сообщения и обновить идентификаторы
    if (authenticated && (!wasAuthenticated || (previousUserId && previousUserId !== newUserId))) {
      console.log('Auth change detected, linking messages and updating identities');
      linkMessages();
      updateIdentities();
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
            processedIds: processedGuestIds.value
          };
        }
        
        // Создаем объект с идентификаторами для передачи на сервер
        const identifiersData = {
          userId: userId.value,
          guestId: localGuestId
        };
        
        // Добавляем все доступные идентификаторы
        if (address.value) identifiersData.address = address.value;
        if (email.value) identifiersData.email = email.value;
        if (telegramId.value) identifiersData.telegramId = telegramId.value;
        
        console.log('Sending link-guest-messages request with data:', identifiersData);
        
        try {
          // Отправляем запрос на связывание сообщений
          const response = await axios.post('/api/auth/link-guest-messages', identifiersData);
          
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
                .filter(result => result.guestId)
                .map(result => result.guestId);
              
              if (newProcessedIds.length > 0) {
                processedGuestIds.value = [...new Set([...processedGuestIds.value, ...newProcessedIds])];
                console.log('Updated processed guest IDs from results:', processedGuestIds.value);
              }
            }
            
            // Очищаем гостевые сообщения из localStorage после успешного связывания
            localStorage.removeItem('guestMessages');
            localStorage.removeItem('guestId');
            
            return {
              success: true,
              processedIds: processedGuestIds.value
            };
          }
        } catch (error) {
          console.error('Error linking messages:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      return { success: false, message: 'Not authenticated' };
    } catch (error) {
      console.error('Error in linkMessages:', error);
      return { success: false, error: error.message };
    }
  };
  
  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/check');
      console.log('Auth check response:', response.data);
      
      const wasAuthenticated = isAuthenticated.value;
      const previousUserId = userId.value;
      const previousAuthType = authType.value;
      
      // Обновляем данные авторизации через updateAuth вместо прямого изменения
      updateAuth({
        authenticated: response.data.authenticated,
        authType: response.data.authType,
        userId: response.data.userId,
        address: response.data.address,
        telegramId: response.data.telegramId,
        email: response.data.email,
        isAdmin: response.data.isAdmin
      });
      
      // Если пользователь аутентифицирован, обновляем список идентификаторов и связываем сообщения
      if (response.data.authenticated) {
        // Сначала обновляем идентификаторы, чтобы иметь актуальные данные
        await updateIdentities();
        
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
      // Сохраняем текущий guestId перед выходом
      const newGuestId = crypto.randomUUID();
      localStorage.setItem('guestId', newGuestId);
      console.log('Created new guestId for future session:', newGuestId);
      
      await axios.post('/api/auth/logout');
      
      // Обновляем состояние в памяти
      updateAuth({ 
        authenticated: false, 
        authType: null, 
        userId: null, 
        address: null, 
        telegramId: null,
        email: null,
        isAdmin: false 
      });
      
      // Обновляем отображение отключенного состояния
      updateConnectionDisplay(false);
      
      // Очищаем списки идентификаторов
      identities.value = [];
      
      // Очищаем localStorage кроме guestId
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userId');
      localStorage.removeItem('address');
      localStorage.removeItem('isAdmin');
      
      // Удаляем класс подключенного кошелька
      document.body.classList.remove('wallet-connected');
      
      console.log('User disconnected successfully');
      
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Обновляем список обработанных guestIds
  const updateProcessedGuestIds = (ids) => {
    if (Array.isArray(ids)) {
      processedGuestIds.value = [...new Set([...processedGuestIds.value, ...ids])];
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
  
  onMounted(async () => {
    await checkAuth();
  });
  
  return {
    isAuthenticated,
    authType,
    userId,
    address,
    isAdmin,
    telegramId,
    email,
    identities,
    processedGuestIds,
    updateAuth,
    checkAuth,
    disconnect,
    linkMessages,
    updateIdentities,
    updateProcessedGuestIds,
    updateConnectionDisplay
  };
} 