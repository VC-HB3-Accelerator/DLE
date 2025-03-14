import { defineStore } from 'pinia';
import axios from '../api/axios';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    authType: null,
    identities: {},
    loading: false,
    error: null,
    messages: [],
    address: null
  }),
  
  actions: {
    async connectWallet(address, signature, message) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/chat/verify', {
          address, 
          signature, 
          message
        }, {
          withCredentials: true
        });
        
        this.user = {
          id: response.data.userId,
          address: address
        };
        this.isAuthenticated = response.data.authenticated;
        this.isAdmin = response.data.isAdmin;
        this.authType = 'wallet';
        
        // Сохраняем адрес кошелька в локальном хранилище
        console.log('Saving wallet address to localStorage:', address);
        localStorage.setItem('walletAddress', address);
        
        // Связываем гостевые сообщения с аутентифицированным пользователем
        try {
          await axios.post('/api/chat/link-guest-messages');
          console.log('Guest messages linked to authenticated user');
        } catch (linkError) {
          console.error('Error linking guest messages:', linkError);
        }
        
        return {
          success: true,
          authenticated: response.data.authenticated,
          address: address,
          isAdmin: response.data.isAdmin,
          authType: response.data.authType
        };
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка подключения кошелька';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async connectTelegram(telegramData) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/telegram', telegramData);
        
        this.user = {
          id: response.data.userId,
          telegramId: telegramData.telegramId
        };
        this.isAuthenticated = response.data.authenticated;
        this.isAdmin = response.data.isAdmin;
        this.authType = response.data.authType;
        this.identities = response.data.identities || {};
        
        return true;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка подключения Telegram';
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async connectEmail(email, verificationCode) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/email', {
          email, verificationCode
        });
        
        this.user = {
          id: response.data.userId,
          email
        };
        this.isAuthenticated = response.data.authenticated;
        this.isAdmin = response.data.isAdmin;
        this.authType = response.data.authType;
        this.identities = response.data.identities || {};
        
        return true;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка подключения Email';
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async linkIdentity(identityType, identityValue) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/link-identity', {
          identityType, identityValue
        });
        
        this.identities = response.data.identities;
        this.isAdmin = response.data.isAdmin;
        
        return true;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка связывания аккаунта';
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    async logout() {
      try {
        await axios.post('/api/auth/logout');
        this.user = null;
        this.isAuthenticated = false;
        this.isAdmin = false;
        this.authType = null;
        this.identities = {};
        this.messages = [];
        this.address = null;
        
        // Удаляем адрес из localStorage
        localStorage.removeItem('walletAddress');
      } catch (error) {
        console.error('Ошибка при выходе:', error);
      }
    },
    
    async checkAuth() {
      try {
        console.log('Checking auth state...');
        const response = await axios.get('/api/auth/check');
        console.log('Auth check response:', response.data);
        
        if (response.data.authenticated) {
          this.isAuthenticated = true;
          this.user = {
            id: response.data.userId,
            address: response.data.address
          };
          this.address = response.data.address;
          this.isAdmin = response.data.isAdmin;
          this.authType = response.data.authType;
          
          return {
            authenticated: true,
            user: this.user,
            address: response.data.address,
            isAdmin: response.data.isAdmin,
            authType: response.data.authType
          };
        } else {
          this.isAuthenticated = false;
          this.user = null;
          this.address = null;
          this.isAdmin = false;
          this.authType = null;
          
          return { authenticated: false };
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        this.isAuthenticated = false;
        this.user = null;
        this.address = null;
        this.isAdmin = false;
        this.authType = null;
        
        return { authenticated: false };
      }
    },
    
    async refreshSession() {
      try {
        // Если есть адрес в localStorage, используем его
        const storedAddress = localStorage.getItem('walletAddress');
        
        const response = await axios.post('/api/auth/refresh-session', {
          address: storedAddress || this.address
        }, {
          withCredentials: true
        });
        
        return response.data.success;
      } catch (error) {
        console.error('Error refreshing session:', error);
        return false;
      }
    },
    
    async checkWalletConnection() {
      // Проверяем, есть ли сохраненный адрес кошелька
      const savedAddress = localStorage.getItem('walletAddress');
      console.log('Checking for saved wallet address:', savedAddress);
      
      if (savedAddress) {
        try {
          // Проверяем, доступен ли провайдер Ethereum (MetaMask)
          if (window.ethereum) {
            // Запрашиваем доступ к аккаунтам
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const currentAddress = accounts[0].toLowerCase();
            
            console.log('Current connected address:', currentAddress);
            console.log('Saved address:', savedAddress.toLowerCase());
            
            // Проверяем, совпадает ли текущий адрес с сохраненным
            if (currentAddress === savedAddress.toLowerCase()) {
              console.log('Wallet address matches, restoring session');
              
              // Восстанавливаем состояние аутентификации
              this.user = {
                id: null, // ID будет получен при проверке аутентификации
                address: savedAddress
              };
              
              // Проверяем аутентификацию на сервере
              const authResult = await this.checkAuth();
              
              if (authResult.authenticated) {
                console.log('Session restored successfully');
                return true;
              }
            } else {
              console.log('Connected wallet address does not match saved address');
              localStorage.removeItem('walletAddress');
            }
          }
        } catch (error) {
          console.error('Error restoring wallet connection:', error);
        }
      }
      
      return false;
    }
  }
});
