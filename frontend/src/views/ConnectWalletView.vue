<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="connect-wallet-container">
    <div class="connect-wallet-card">
      <!-- Loading состояние -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Проверка токена...</p>
      </div>

      <!-- Токен валиден -->
      <div v-else-if="tokenValid && !connected" class="connect-state">
        <div class="icon">🔗</div>
        <h1>Подключение кошелька</h1>
        
        <div class="info-block">
          <p class="provider-info">
            Вы переходите из: 
            <strong>{{ providerName }}</strong>
          </p>
          <p class="description">
            Подключите Web3 кошелек для сохранения истории сообщений и полного доступа к системе
          </p>
        </div>

        <button 
          @click="connectWallet" 
          :disabled="connecting"
          class="connect-button"
        >
          <span v-if="!connecting">Подключить MetaMask</span>
          <span v-else>Подключение...</span>
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="expires-info">
          ⏱ Ссылка истекает: {{ expiresAt }}
        </div>
      </div>

      <!-- Токен истек или недействителен -->
      <div v-else-if="!tokenValid" class="expired-state">
        <div class="icon">⏰</div>
        <h1>Ссылка истекла</h1>
        <p>Эта ссылка больше недействительна</p>
        <p class="hint">
          Запросите новую ссылку в боте, отправив команду 
          <code>/connect</code>
        </p>
      </div>

      <!-- Успешно подключено -->
      <div v-else-if="connected" class="success-state">
        <div class="icon">✅</div>
        <h1>Кошелек подключен!</h1>
        <p>История сообщений перенесена</p>
        <p class="stats" v-if="migrationStats">
          Перенесено сообщений: {{ migrationStats.migrated }}
        </p>
        <button @click="goToChat" class="go-chat-button">
          Перейти к чату
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConnectWalletView',

  data() {
    return {
      loading: true,
      tokenValid: false,
      connected: false,
      connecting: false,
      error: null,
      provider: null,
      expiresAt: null,
      migrationStats: null
    };
  },

  computed: {
    providerName() {
      const names = {
        telegram: 'Telegram',
        email: 'Email'
      };
      return names[this.provider] || this.provider;
    }
  },

  async mounted() {
    const token = this.$route.query.token;
    if (!token) {
      this.loading = false;
      this.tokenValid = false;
      return;
    }

    await this.checkToken(token);
  },

  methods: {
    async checkToken(token) {
      try {
        const response = await fetch(`/api/identity/link-status/${token}`);
        const data = await response.json();

        this.tokenValid = data.valid;
        this.provider = data.provider;
        
        if (data.expiresAt) {
          const expiresDate = new Date(data.expiresAt);
          this.expiresAt = expiresDate.toLocaleString('ru-RU');
        }

        this.loading = false;

      } catch (error) {
        console.error('Ошибка проверки токена:', error);
        this.error = 'Ошибка проверки токена';
        this.loading = false;
        this.tokenValid = false;
      }
    },

    async connectWallet() {
      try {
        this.connecting = true;
        this.error = null;

        // Проверяем наличие MetaMask
        if (!window.ethereum) {
          this.error = 'MetaMask не установлен. Установите расширение MetaMask.';
          this.connecting = false;
          return;
        }

        // 1. Запрос аккаунтов
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (!accounts || accounts.length === 0) {
          this.error = 'Не удалось получить адрес кошелька';
          this.connecting = false;
          return;
        }

        const address = accounts[0];

        // 2. Получить подпись
        const message = `Подключение кошелька к системе\nАдрес: ${address}\nВремя: ${new Date().toISOString()}`;
        
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });

        // 3. Отправить на сервер
        const token = this.$route.query.token;
        const response = await fetch('/api/auth/wallet-with-link', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          credentials: 'include',
          body: JSON.stringify({ 
            address, 
            signature, 
            message,
            token 
          })
        });

        const result = await response.json();

        if (result.success) {
          this.connected = true;
          this.migrationStats = {
            migrated: result.migratedMessages
          };
          
          // Через 2 секунды переходим в чат
          setTimeout(() => {
            this.goToChat();
          }, 2000);

        } else {
          this.error = result.error || 'Ошибка подключения кошелька';
          this.connecting = false;
        }

      } catch (error) {
        console.error('Ошибка подключения кошелька:', error);
        
        if (error.code === 4001) {
          this.error = 'Вы отклонили запрос подписи';
        } else {
          this.error = 'Ошибка подключения кошелька. Попробуйте снова.';
        }
        
        this.connecting = false;
      }
    },

    goToChat() {
      this.$router.push('/chat');
    }
  }
};
</script>

<style scoped>
.connect-wallet-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.connect-wallet-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 40px;
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.icon {
  font-size: 64px;
  margin-bottom: 20px;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 16px;
}

.info-block {
  margin: 24px 0;
}

.provider-info {
  font-size: 16px;
  color: #666;
  margin-bottom: 12px;
}

.provider-info strong {
  color: #667eea;
  font-weight: 600;
}

.description {
  font-size: 14px;
  color: #888;
  line-height: 1.6;
}

.connect-button,
.go-chat-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 32px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  margin-top: 24px;
}

.connect-button:hover:not(:disabled),
.go-chat-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 14px;
}

.expires-info {
  margin-top: 20px;
  font-size: 13px;
  color: #999;
}

.loading-state {
  padding: 40px 20px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-state p {
  color: #666;
  font-size: 14px;
}

.expired-state,
.success-state {
  padding: 20px 0;
}

.hint {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 8px;
  margin-top: 20px;
  font-size: 14px;
  color: #666;
}

.hint code {
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  color: #333;
}

.stats {
  background: #f0f9ff;
  color: #0369a1;
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .connect-wallet-container {
    padding: 16px;
  }
  
  .connect-wallet-card {
    padding: 30px 24px;
    max-width: 100%;
  }
  
  .icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  h1 {
    font-size: 24px;
    margin-bottom: 12px;
  }
  
  .info-block {
    margin: 20px 0;
  }
  
  .provider-info {
    font-size: 14px;
  }
  
  .description {
    font-size: 13px;
  }
  
  .connect-button,
  .go-chat-button {
    padding: 12px 24px;
    font-size: 15px;
  }
}

@media (max-width: 480px) {
  .connect-wallet-container {
    padding: 12px;
  }
  
  .connect-wallet-card {
    padding: 24px 16px;
    border-radius: 12px;
  }
  
  .icon {
    font-size: 40px;
    margin-bottom: 12px;
  }
  
  h1 {
    font-size: 20px;
    margin-bottom: 10px;
  }
  
  .provider-info {
    font-size: 13px;
  }
  
  .description {
    font-size: 12px;
  }
  
  .connect-button,
  .go-chat-button {
    padding: 10px 20px;
    font-size: 14px;
  }
  
  .error-message {
    font-size: 13px;
    padding: 10px;
  }
  
  .expires-info {
    font-size: 12px;
  }
  
  .hint {
    font-size: 13px;
    padding: 10px;
  }
  
  .stats {
    font-size: 13px;
    padding: 10px;
  }
}
</style>

