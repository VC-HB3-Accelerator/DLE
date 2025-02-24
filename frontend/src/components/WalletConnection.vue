<template>
  <div class="wallet-connection">
    <div v-if="!isConnected" class="header">
      <h1>DApp for Business</h1>
      <button 
        @click="connectWallet"
        class="connect-button"
      >
        Подключить кошелек
      </button>
    </div>
    <div v-else class="header">
      <h1>DApp for Business</h1>
      <div class="wallet-info">
        <span class="address">{{ shortenAddress(userAddress) }}</span>
        <button @click="disconnectWallet" class="disconnect-btn">
          Отключить
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  isConnected: Boolean,
  userAddress: String
});

const emit = defineEmits(['connect', 'disconnect']);

// Проверка сессии при загрузке
async function checkSession() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/session', {
      credentials: 'include'
    });
    
    if (!response.ok) return;
    
    const data = await response.json();
    if (data.authenticated) {
      emit('connect', data.address);
    }
  } catch (error) {
    console.error('Ошибка проверки сессии:', error);
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      alert('Пожалуйста, установите MetaMask для работы с приложением');
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }

    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (accounts.length > 0) {
      const address = accounts[0];
      
      // Получаем nonce
      const nonceResponse = await fetch('http://127.0.0.1:3000/api/nonce', {
        credentials: 'include'
      });
      
      if (!nonceResponse.ok) {
        throw new Error('Failed to get nonce');
      }
      
      const { nonce } = await nonceResponse.json();
      
      // Создаем сообщение для подписи
      const message = {
        domain: window.location.host,
        address: address,
        statement: 'Sign in with Ethereum to access DApp features and AI Assistant',
        uri: window.location.origin,
        version: '1',
        chainId: '11155111',
        nonce: nonce,
        issuedAt: new Date().toISOString(),
        resources: [
          `${window.location.origin}/api/chat`,
          `${window.location.origin}/api/contract`
        ]
      };
      
      console.log('Подписываем сообщение:', message);
      
      // Получаем подпись
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [
          JSON.stringify(message, null, 2),
          address
        ]
      });
      
      console.log('Получена подпись:', signature);
      
      // Верифицируем подпись
      const verifyResponse = await fetch('http://127.0.0.1:3000/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          signature
        })
      });
      
      if (!verifyResponse.ok) {
        const error = await verifyResponse.text();
        throw new Error(`Failed to verify signature: ${error}`);
      }
      
      const { isAdmin } = await verifyResponse.json();
      emit('connect', address);
      return isAdmin;
    }
  } catch (error) {
    console.error('Ошибка подключения:', error);
    alert('Ошибка подключения кошелька: ' + error.message);
  }
}

async function disconnectWallet() {
  try {
    // Выходим из системы
    const response = await fetch('http://127.0.0.1:3000/api/signout', {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to sign out');
    }

    emit('disconnect');
  } catch (error) {
    console.error('Error disconnecting:', error);
    alert('Ошибка при отключении');
  }
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

onMounted(() => {
  checkSession();
});
</script>

<style scoped>
.wallet-connection {
  display: flex;
  justify-content: space-between;
  padding: 1.5rem 2rem;
  background: white;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 99;
  box-sizing: border-box;
}

.header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #2c3e50;
  font-weight: 600;
  line-height: 1;
}

.connect-button {
  padding: 0.5rem 1rem;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  min-width: 180px;
  text-align: center;
}

.connect-btn,
.disconnect-btn {
  padding: 0.5rem 1rem;
  height: 36px;
  line-height: 1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
}

.connect-btn {
  background: #28a745;
}

.disconnect-btn {
  padding: 0.5rem 1rem;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.address {
  font-family: monospace;
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
}
</style> 