<template>
  <div class="linked-accounts">
    <h2>Связанные аккаунты</h2>
    
    <div v-if="loading" class="loading">
      Загрузка...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else>
      <div v-if="identities.length === 0" class="no-accounts">
        У вас нет связанных аккаунтов.
      </div>
      
      <div v-else class="accounts-list">
        <div v-for="identity in identities" :key="`${identity.identity_type}-${identity.identity_value}`" class="account-item">
          <div class="account-type">
            {{ getIdentityTypeLabel(identity.identity_type) }}
          </div>
          <div class="account-value">
            {{ formatIdentityValue(identity) }}
          </div>
          <button @click="unlinkAccount(identity)" class="unlink-button">
            Отвязать
          </button>
        </div>
      </div>
      
      <div class="link-instructions">
        <h3>Как связать аккаунты</h3>
        
        <div class="instruction">
          <h4>Telegram</h4>
          <p>Отправьте боту команду:</p>
          <code>/link {{ userAddress }}</code>
        </div>
        
        <div class="instruction">
          <h4>Email</h4>
          <p>Отправьте письмо на адрес бота с темой:</p>
          <code>link {{ userAddress }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'LinkedAccounts',
  
  data() {
    return {
      loading: true,
      error: null,
      identities: [],
      userAddress: ''
    };
  },
  
  async mounted() {
    this.userAddress = this.$store.state.auth.address;
    await this.loadIdentities();
  },
  
  methods: {
    async loadIdentities() {
      try {
        this.loading = true;
        this.error = null;
        
        const response = await axios.get('/api/identities', {
          withCredentials: true
        });
        
        this.identities = response.data.identities;
      } catch (error) {
        console.error('Error loading identities:', error);
        this.error = 'Не удалось загрузить связанные аккаунты. Попробуйте позже.';
      } finally {
        this.loading = false;
      }
    },
    
    async unlinkAccount(identity) {
      try {
        await axios.delete(`/api/identities/${identity.identity_type}/${identity.identity_value}`, {
          withCredentials: true
        });
        
        // Обновляем список идентификаторов
        await this.loadIdentities();
      } catch (error) {
        console.error('Error unlinking account:', error);
        alert('Не удалось отвязать аккаунт. Попробуйте позже.');
      }
    },
    
    getIdentityTypeLabel(type) {
      const labels = {
        ethereum: 'Ethereum',
        telegram: 'Telegram',
        email: 'Email'
      };
      
      return labels[type] || type;
    },
    
    formatIdentityValue(identity) {
      if (identity.identity_type === 'ethereum') {
        // Сокращаем Ethereum-адрес
        const value = identity.identity_value;
        return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
      }
      
      return identity.identity_value;
    }
  }
};
</script>

<style scoped>
.linked-accounts {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.loading, .error, .no-accounts {
  margin: 20px 0;
  padding: 10px;
  text-align: center;
}

.error {
  color: #e74c3c;
  border: 1px solid #e74c3c;
  border-radius: 4px;
}

.accounts-list {
  margin: 20px 0;
}

.account-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.account-type {
  font-weight: bold;
  width: 100px;
}

.account-value {
  flex: 1;
}

.unlink-button {
  background-color: #e74c3c;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.link-instructions {
  margin-top: 30px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.instruction {
  margin-bottom: 15px;
}

code {
  display: block;
  padding: 10px;
  background-color: #eee;
  border-radius: 4px;
  margin-top: 5px;
}
</style> 