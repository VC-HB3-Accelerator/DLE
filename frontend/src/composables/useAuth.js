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
  
  const updateAuth = ({ authenticated, authType: newAuthType, userId: newUserId, address: newAddress, telegramId: newTelegramId, isAdmin: newIsAdmin, email: newEmail }) => {
    isAuthenticated.value = authenticated;
    authType.value = newAuthType;
    userId.value = newUserId;
    address.value = newAddress;
    telegramId.value = newTelegramId;
    isAdmin.value = newIsAdmin;
    email.value = newEmail;
  };
  
  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/check');
      console.log('Auth check response:', response.data);
      
      isAuthenticated.value = response.data.authenticated;
      userId.value = response.data.userId;
      isAdmin.value = response.data.isAdmin;
      authType.value = response.data.authType;
      address.value = response.data.address;
      telegramId.value = response.data.telegramId;
      email.value = response.data.email;
      
      return response.data;
    } catch (error) {
      console.error('Error checking auth:', error);
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
        email: null,
        isAdmin: false 
      });
      
      // Очищаем localStorage
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('userId');
      localStorage.removeItem('address');
      localStorage.removeItem('isAdmin');
      
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
    isAdmin,
    telegramId,
    email,
    updateAuth,
    checkAuth,
    disconnect
  };
} 