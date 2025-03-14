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
    },
    
    async requestEmailVerification(email) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/email/request', { email });
        
        console.log('Email verification code response:', response.data);
        
        return {
          success: true,
          message: response.data.message,
          verificationCode: response.data.verificationCode // Для разработки
        };
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка запроса кода';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async verifyEmail(code) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/email/verify', { code });
        
        if (response.data.success) {
          this.isAuthenticated = true;
          this.user = {
            id: response.data.userId,
            email: response.data.email
          };
          
          if (response.data.walletAddress) {
            this.user.address = response.data.walletAddress;
            this.address = response.data.walletAddress;
          }
          
          this.isAdmin = response.data.isAdmin;
          this.authType = 'email';
        }
        
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка верификации';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async requestTelegramCode() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.get('/api/auth/telegram/code');
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка запроса кода';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async verifyTelegram(telegramId, code) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/telegram/verify', { telegramId, code });
        
        if (response.data.success) {
          this.isAuthenticated = true;
          this.user = {
            id: response.data.userId,
            telegramId: response.data.telegramId
          };
          
          if (response.data.walletAddress) {
            this.user.address = response.data.walletAddress;
            this.address = response.data.walletAddress;
          }
          
          this.isAdmin = response.data.isAdmin;
          this.authType = 'telegram';
        }
        
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка верификации';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async linkIdentity(type, value) {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/link-identity', { type, value });
        
        if (response.data.success) {
          if (type === 'wallet') {
            this.user.address = value;
            this.address = value;
          } else if (type === 'email') {
            this.user.email = value;
          } else if (type === 'telegram') {
            this.user.telegramId = value;
          }
          
          this.isAdmin = response.data.isAdmin;
        }
        
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка связывания аккаунта';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async createTelegramAuthToken() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/auth/telegram/auth-token');
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Ошибка создания токена';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },
    
    async checkTelegramAuthStatus(token) {
      try {
        const response = await axios.get(`/api/auth/telegram/auth-status/${token}`);
        
        if (response.data.success && response.data.authenticated) {
          // Обновляем состояние аутентификации
          await this.checkAuth();
        }
        
        return response.data;
      } catch (error) {
        console.error('Error checking Telegram auth status:', error);
        return { success: false, error: 'Ошибка проверки статуса' };
      }
    }
  }
});
