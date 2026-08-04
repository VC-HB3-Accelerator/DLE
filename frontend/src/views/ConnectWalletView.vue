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
        <p>{{ t('wallet.checkingToken') }}</p>
      </div>

      <!-- Токен валиден -->
      <div v-else-if="tokenValid && !connected" class="connect-state">
        <h1>{{ t('wallet.title') }}</h1>
        
        <div class="info-block">
          <p class="provider-info">
            {{ t('wallet.comingFrom') }}
            <strong>{{ providerName }}</strong>
          </p>
          <p class="description">
            {{ t('wallet.description') }}
          </p>
        </div>

        <button 
          @click="connectWallet" 
          :disabled="connecting"
          class="connect-button"
        >
          <span v-if="!connecting">{{ t('wallet.connectMetaMask') }}</span>
          <span v-else>{{ t('wallet.connecting') }}</span>
        </button>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div class="expires-info">
          {{ t('wallet.linkExpires', { date: expiresAt }) }}
        </div>
      </div>

      <!-- Токен истек или недействителен -->
      <div v-else-if="!tokenValid" class="expired-state">
        <h1>{{ t('wallet.linkExpiredTitle') }}</h1>
        <p>{{ t('wallet.linkExpiredText') }}</p>
        <p class="hint">
          {{ t('wallet.linkExpiredHintBefore') }}
          <code>/connect</code>
          {{ t('wallet.linkExpiredHintAfter') }}
        </p>
      </div>

      <!-- Успешно подключено -->
      <div v-else-if="connected" class="success-state">
        <h1>{{ t('wallet.walletConnected') }}</h1>
        <p>{{ t('wallet.historyMigrated') }}</p>
        <p class="stats" v-if="migrationStats">
          {{ t('wallet.messagesMigrated', { count: migrationStats.migrated }) }}
        </p>
        <button @click="goToChat" class="go-chat-button">
          {{ t('wallet.goToChat') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useI18n } from 'vue-i18n';

export default {
  name: 'ConnectWalletView',

  setup() {
    const { t } = useI18n();
    return { t };
  },

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
        const response = await fetch(`/api/identities/link-status/${token}`);
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
        this.error = this.t('wallet.errors.tokenCheck');
        this.loading = false;
        this.tokenValid = false;
      }
    },

    async connectWallet() {
      try {
        this.connecting = true;
        this.error = null;

        if (!window.ethereum) {
          this.error = this.t('wallet.errors.metamaskNotInstalled');
          this.connecting = false;
          return;
        }

        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (!accounts || accounts.length === 0) {
          this.error = this.t('wallet.errors.addressFailed');
          this.connecting = false;
          return;
        }

        const address = accounts[0];

        const message = this.t('wallet.signMessage', {
          address,
          time: new Date().toISOString()
        });
        
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address]
        });

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
          
          setTimeout(() => {
            this.goToChat();
          }, 2000);

        } else {
          this.error = result.error || this.t('wallet.errors.connectFailed');
          this.connecting = false;
        }

      } catch (error) {
        console.error('Ошибка подключения кошелька:', error);
        
        if (error.code === 4001) {
          this.error = this.t('wallet.errors.signatureRejected');
        } else {
          this.error = this.t('wallet.errors.connectFailedRetry');
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

h1 {
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--color-dark);
  margin-bottom: var(--spacing-md);
}

.info-block {
  margin: var(--spacing-xl) 0;
}

.provider-info {
  font-size: var(--font-size-lg);
  color: var(--color-text-light);
  margin-bottom: var(--spacing-sm);
}

.provider-info strong {
  color: var(--color-dark);
  font-weight: 600;
}

.description {
  font-size: var(--font-size-md);
  color: var(--color-text-light);
  line-height: 1.6;
}

.connect-button,
.go-chat-button {
  background: var(--color-primary);
  color: var(--color-white);
  border: 1px solid var(--color-primary);
  border-radius: var(--button-radius);
  height: var(--button-height);
  padding: 0 var(--spacing-xl);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  width: 100%;
  margin-top: var(--spacing-xl);
}

.connect-button:hover:not(:disabled),
.go-chat-button:hover {
  background: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.connect-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: color-mix(in srgb, var(--color-danger) 12%, white);
  color: var(--color-danger);
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, white);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-lg);
  margin-top: var(--spacing-md);
  font-size: var(--font-size-md);
}

.expires-info {
  margin-top: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-light);
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
