import { ref, onMounted } from 'vue';
import axios from '../api/axios';

export function useAuth() {
  const isAuthenticated = ref(false);
  const authType = ref(null);
  const userId = ref(null);
  const address = ref(null);
  const telegramInfo = ref(null);
  const isAdmin = ref(false);
  const telegramId = ref(null);
  
  const updateAuth = ({ authenticated, authType: newAuthType, userId: newUserId, address: newAddress, telegramId: newTelegramId, isAdmin: newIsAdmin }) => {
    isAuthenticated.value = authenticated;
    authType.value = newAuthType;
    userId.value = newUserId;
    address.value = newAddress;
    telegramId.value = newTelegramId;
    isAdmin.value = newIsAdmin;
  };
  
  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/check');
      console.log('Auth check response:', response.data);
      updateAuth(response.data);
      return response.data;
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { authenticated: false };
    }
  };
  
  const disconnect = async () => {
    try {
      await axios.post('/api/auth/logout');
      updateAuth({ 
        authenticated: false, 
        authType: null, 
        userId: null, 
        address: null, 
        telegramId: null,
        isAdmin: false 
      });
      
      // Очищаем localStorage
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userId');
      localStorage.removeItem('address');
      localStorage.removeItem('isAdmin');
      
      // Перезагружаем страницу
      window.location.reload();
      
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting:', error);
      return { success: false, error: error.message };
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
    telegramInfo,
    isAdmin,
    telegramId,
    updateAuth,
    checkAuth,
    disconnect
  };
} 