<template>
  <div class="contract-interaction">
    <h2>Управление контрактом</h2>
    
    <div v-if="!isConnected" class="warning">
      Пожалуйста, подключите кошелек для управления контрактом
      <appkit-button />
    </div>
    
    <div v-else>
      <div class="owner-info">
        <p>Текущий владелец: 
          <span v-if="loading">Загрузка...</span>
          <span v-else-if="owner">{{ formatAddress(owner) }}</span>
          <span v-else>Не удалось загрузить</span>
        </p>
      </div>

      <div class="owner-controls">
        <input 
          v-model="newOwner" 
          placeholder="Адрес нового владельца (0x...)" 
          :disabled="!isConnected"
        />
        <button 
          @click="setNewOwner" 
          :disabled="!isConnected || !isValidAddress(newOwner)"
        >
          Установить нового владельца
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider, useAppKit } from '@reown/appkit/vue';
import config from '../config';

export default {
  name: 'ContractInteraction',
  setup() {
    const owner = ref('');
    const newOwner = ref('');
    const loading = ref(false);
    const { address, isConnected } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider('eip155');
    const { contractAddress, contractABI } = config.contract;

    const { open } = useAppKit(); // Получаем функцию открытия модала

    const formatAddress = (addr) => addr.slice(0, 6) + '...' + addr.slice(-4);

    const isValidAddress = (addr) => {
      try {
        return ethers.isAddress(addr);
      } catch {
        return false;
      }
    };

    // Следим за изменением состояния подключения
    watch(isConnected, async (newValue) => {
      console.log('Connection state changed:', newValue);
      if (newValue) {
        await fetchOwner();
      } else {
        owner.value = '';
      }
    });

    const handleConnect = async () => {
      try {
        console.log('Attempting to connect wallet...');
        await open(); // Используем хуки для открытия модала
        console.log('Wallet connected successfully');
      } catch (error) {
        console.error('Wallet connection error:', error);
      }
    };

    const fetchOwner = async () => {
      if (!isConnected.value || !walletProvider) {
        console.log('Cannot fetch owner: wallet not connected');
        return;
      }
      loading.value = true;
      try {
        console.log('Получаем владельца контракта...');
        const ethersProvider = new ethers.BrowserProvider(walletProvider);
        const contract = new ethers.Contract(contractAddress, contractABI, ethersProvider);
        owner.value = await contract.owner();
        console.log('Владелец контракта:', owner.value);
      } catch (error) {
        console.error('Ошибка при получении владельца:', error);
        owner.value = '';
      } finally {
        loading.value = false;
      }
    };

    const setNewOwner = async () => {
      try {
        if (!isConnected.value) {
          console.log('Пожалуйста, подключите кошелек');
          return;
        }
        if (!isValidAddress(newOwner.value)) {
          console.log('Неверный адрес');
          return;
        }
        
        const ethersProvider = new ethers.BrowserProvider(walletProvider);
        const signer = await ethersProvider.getSigner();
        const contract = new ethers.Contract(contractAddress, contractABI, signer);
        
        const tx = await contract.setOwner(newOwner.value);
        await tx.wait();
        
        await fetchOwner();
        newOwner.value = '';
      } catch (error) {
        console.error('Ошибка при установке нового владельца:', error);
      }
    };

    onMounted(async () => {
      if (isConnected.value) {
        await fetchOwner();
      }
    });

    return {
      owner,
      newOwner,
      isConnected,
      loading,
      handleConnect,
      setNewOwner,
      formatAddress,
      isValidAddress
    };
  }
};
</script>

<style scoped>
.contract-interaction {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.warning {
  color: #721c24;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.owner-info {
  margin-bottom: 20px;
}

.owner-controls {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #45a049;
}

.connect-button {
  margin-top: 10px;
  background-color: #007bff;
}

.connect-button:hover:not(:disabled) {
  background-color: #0056b3;
}
</style> 