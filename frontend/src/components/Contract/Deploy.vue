<template>
  <div class="contract-deploy">
    <h2>Деплой смарт-контракта</h2>
    
    <form @submit.prevent="deployContract" class="deploy-form">
      <div class="form-group">
        <label>Начальная цена (ETH)</label>
        <input 
          v-model="initialPrice"
          type="number"
          step="0.001"
          min="0"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label>Название токена</label>
        <input 
          v-model="tokenName"
          type="text"
          required
          class="form-input"
        />
      </div>

      <div class="form-group">
        <label>Символ токена</label>
        <input 
          v-model="tokenSymbol"
          type="text"
          required
          class="form-input"
        />
      </div>

      <button 
        type="submit"
        :disabled="isDeploying"
        class="deploy-button"
      >
        {{ isDeploying ? 'Деплой...' : 'Деплой контракта' }}
      </button>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="deployedAddress" class="success-message">
        Контракт развернут по адресу: {{ deployedAddress }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ethers } from 'ethers'
import contractABI from '../../artifacts/MyContract.json'

const initialPrice = ref(0.01)
const tokenName = ref('')
const tokenSymbol = ref('')
const isDeploying = ref(false)
const error = ref('')
const deployedAddress = ref('')

async function deployContract() {
  if (!window.ethereum) {
    error.value = 'MetaMask не установлен'
    return
  }

  try {
    isDeploying.value = true
    error.value = ''

    const provider = new ethers.BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()

    // Создаем фабрику контракта
    const factory = new ethers.ContractFactory(
      contractABI.abi,
      contractABI.bytecode,
      signer
    )

    // Деплоим контракт
    const contract = await factory.deploy(
      ethers.parseEther(initialPrice.value.toString()),
      tokenName.value,
      tokenSymbol.value
    )

    await contract.waitForDeployment()
    deployedAddress.value = await contract.getAddress()

  } catch (err) {
    console.error('Ошибка деплоя:', err)
    error.value = err.message
  } finally {
    isDeploying.value = false
  }
}
</script>

<style scoped>
.contract-deploy {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.deploy-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #2c3e50;
}

.form-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.deploy-button {
  width: 100%;
  padding: 10px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.deploy-button:disabled {
  background-color: #cccccc;
}

.error-message {
  color: #dc3545;
  margin-top: 10px;
}

.success-message {
  color: #28a745;
  margin-top: 10px;
}
</style>
