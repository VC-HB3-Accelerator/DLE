import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false);
  const isAdmin = ref(false);
  const address = ref(null);
  const authType = ref(null);
  const loading = ref(false);
  const checkPerformed = ref(false);

  // Проверка аутентификации
  async function checkAuth() {
    loading.value = true;

    try {
      console.log('Проверка аутентификации...');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      console.log('API URL:', apiUrl);

      const response = await axios.get(`${apiUrl}/api/auth/check`, {
        withCredentials: true,
      });

      console.log('Статус аутентификации:', response.data.authenticated);
      console.log('Статус администратора:', response.data.isAdmin);

      isAuthenticated.value = response.data.authenticated;
      isAdmin.value = response.data.isAdmin;
      address.value = response.data.address;
      authType.value = response.data.authType;
    } catch (error) {
      console.error('Ошибка при проверке аутентификации:', error);
      throw error;
    } finally {
      loading.value = false;
      checkPerformed.value = true;
    }
  }

  // Обновление состояния аутентификации
  function updateAuthState(authData) {
    console.log('Обновление состояния аутентификации:', authData);

    isAuthenticated.value = authData.authenticated || false;
    isAdmin.value = authData.isAdmin || false;
    address.value = authData.address || null;
    authType.value = authData.authType || null;
    checkPerformed.value = true;
  }

  // Выход из системы
  async function logout() {
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/logout`,
        {},
        {
          withCredentials: true,
        }
      );
    } catch (error) {
      console.error('Ошибка при выходе из системы:', error);
    } finally {
      // Сбрасываем состояние независимо от результата запроса
      isAuthenticated.value = false;
      isAdmin.value = false;
      address.value = null;
      authType.value = null;
    }
  }

  return {
    isAuthenticated,
    isAdmin,
    address,
    authType,
    loading,
    checkPerformed,
    checkAuth,
    updateAuthState,
    logout,
  };
});
