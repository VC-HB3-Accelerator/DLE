import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const address = ref(null);
  const isAdmin = ref(false);
  const authType = ref(null);

  // Функция для установки состояния аутентификации
  function setAuth(authData) {
    isAuthenticated.value = true;
    address.value = authData.address;
    isAdmin.value = authData.isAdmin;
    authType.value = authData.authType;
    
    // Сохраняем состояние аутентификации в localStorage
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userAddress', authData.address);
    localStorage.setItem('isAdmin', authData.isAdmin);
    localStorage.setItem('authType', authData.authType);
    
    console.log('Setting auth:', authData);
  }

  // Функция для выхода из системы
  async function disconnect() {
    console.log('Disconnecting user');
    
    try {
      // Отправляем запрос на выход
      await axios.post('/api/auth/logout');
    } catch (error) {
      console.error('Error logging out:', error);
    }
    
    // Сбрасываем состояние аутентификации
    isAuthenticated.value = false;
    address.value = null;
    isAdmin.value = false;
    authType.value = null;
    
    // Удаляем данные из localStorage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userAddress');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('authType');
  }

  // Функция для восстановления состояния аутентификации из localStorage
  async function restoreAuth() {
    try {
      const response = await axios.get('/api/auth/check', { withCredentials: true });
      if (response.data.authenticated) {
        this.setAuth({
          address: response.data.address,
          isAdmin: response.data.isAdmin,
          authType: response.data.authType
        });
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    }
  }

  // Функция для проверки сессии на сервере
  async function checkSession() {
    try {
      const response = await axios.get('/api/auth/check');
      console.log('Session check response:', response.data);
      
      // Если сессия истекла, выходим из системы
      if (!response.data.authenticated && isAuthenticated.value) {
        console.log('Session expired, logging out');
        disconnect();
      }
      
      return response.data;
    } catch (error) {
      console.error('Error checking session:', error);
      return { authenticated: false };
    }
  }

  return {
    isAuthenticated,
    address,
    isAdmin,
    authType,
    setAuth,
    disconnect,
    restoreAuth,
    checkSession
  };
}); 