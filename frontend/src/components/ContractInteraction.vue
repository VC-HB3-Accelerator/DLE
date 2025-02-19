<template>
  <div class="contract-interaction">
    <h2>Взаимодействие с контрактом</h2>
    
    <div v-if="!isInitialized" class="loading-message">
      Загрузка контракта...
    </div>
    
    <div v-if="!isConnected">
      <button 
        @click="connectWallet"
        class="connect-button"
      >
        Подключить кошелек
      </button>
    </div>
    
    <div v-if="error" class="error-message">{{ error }}</div>
    
    <div v-if="isConnected && isCorrectNetwork" class="wallet-info">
      <p>Адрес кошелька: {{ address }}</p>
      
      <div class="contract-controls">
        <h3>Управление контрактом</h3>
        <p v-if="currentPrice" class="price-info">
          Текущая цена: {{ formatPrice(currentPrice) }} ETH
        </p>

        <!-- Панель управления для владельца -->
        <div v-if="isOwner" class="owner-controls">
          <h4>Панель владельца</h4>
          <div class="input-group">
            <input 
              v-model="newPrice" 
              type="number" 
              step="0.001"
              placeholder="Новая цена (ETH)"
              class="amount-input"
            />
            <button 
              @click="handleSetPrice" 
              :disabled="!newPrice || isLoading"
              class="admin-button"
            >
              Установить цену
            </button>
          </div>
          <button 
            @click="handleWithdraw" 
            :disabled="isLoading"
            class="admin-button withdraw-button"
          >
            Вывести средства
          </button>
        </div>

        <!-- Панель покупки -->
        <div class="purchase-panel">
          <h4>Покупка</h4>
          <div class="input-group">
            <input 
              v-model="amount" 
              type="number" 
              placeholder="Введите количество"
              class="amount-input"
            />
            <button 
              @click="handlePurchase" 
              :disabled="!amount || isLoading"
              class="purchase-button"
            >
              {{ isLoading ? 'Обработка...' : 'Купить' }}
            </button>
          </div>
          <p v-if="amount && currentPrice" class="total-cost">
            Общая стоимость: {{ formatPrice(calculateTotalCost()) }} ETH
          </p>
        </div>
        
        <p v-if="success" class="success-message">{{ success }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther } from 'ethers'

// Инициализируем все ref переменные в начале
const amount = ref('')
const newPrice = ref('')
const isLoading = ref(false)
const error = ref('')
const success = ref('')
const currentPrice = ref(null)
const contractOwner = ref(null)
const isCorrectNetwork = ref(false)
const isConnected = ref(false)
const isInitialized = ref(false)
const address = ref(null)
const walletProvider = ref(null)
const isAuthenticated = ref(false)

// Константы
const SEPOLIA_CHAIN_ID = 11155111
const provider = new JsonRpcProvider(import.meta.env.VITE_APP_ETHEREUM_NETWORK_URL)
const contractAddress = '0xD1789d2E00e4af3157330ADFbb813427696c8A01'
const contractABI = [
  'function purchase(uint256 amount) payable',
  'function price() view returns (uint256)',
  'function owner() view returns (address)',
  'function setPrice(uint256 newPrice) public',
  'function withdraw() public',
  'event Purchase(address buyer, uint256 amount)'
]

// Вычисляемые свойства
const isOwner = computed(() => {
  return address.value && contractOwner.value && 
         address.value.toLowerCase() === contractOwner.value.toLowerCase()
})

// Функции
function formatPrice(price) {
  if (!price) return '0'
  return formatEther(price)
}

// Функция инициализации контракта
async function initializeContract() {
  try {
    if (!provider) {
      throw new Error('Provider не доступен')
    }
    
    const contract = new Contract(contractAddress, contractABI, provider)
    await Promise.all([
      contract.price().then(price => {
        currentPrice.value = price
        console.log('Начальная цена:', formatEther(price), 'ETH')
      }),
      contract.owner().then(owner => {
        contractOwner.value = owner
        console.log('Владелец контракта:', owner)
      })
    ])
    
    isInitialized.value = true
  } catch (err) {
    console.error('Ошибка при инициализации контракта:', err)
    error.value = 'Ошибка при инициализации контракта: ' + err.message
  }
}

// Функция подключения к MetaMask
async function connectWallet() {
  try {
    // Проверяем доступность MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask не установлен')
    }

    // Запрашиваем доступ к аккаунту
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    })

    // Сохраняем адрес и провайдер
    address.value = accounts[0]
    walletProvider.value = window.ethereum
    isConnected.value = true

    // Подписываемся на изменение аккаунта
    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    await checkNetwork()
  } catch (err) {
    console.error('Ошибка при подключении кошелька:', err)
    error.value = 'Ошибка при подключении кошелька: ' + err.message
  }
}

// Обработчики событий MetaMask
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // MetaMask отключен
    isConnected.value = false
    address.value = null
  } else {
    // Аккаунт изменен
    address.value = accounts[0]
  }
}

function handleChainChanged() {
  // При смене сети перезагружаем страницу
  window.location.reload()
}

// Обновляем watch
watch(isConnected, async (newValue) => {
  try {
    if (newValue) {
      console.log('Кошелек подключен, адрес:', address.value)
      
      if (!isInitialized.value) {
        await initializeContract()
      }
      await checkNetwork()
    } else {
      console.log('Кошелек отключен')
      currentPrice.value = null
      contractOwner.value = null
      isCorrectNetwork.value = false
      error.value = ''
      isInitialized.value = false
    }
  } catch (err) {
    console.error('Ошибка при обработке подключения:', err)
    error.value = 'Ошибка при обработке подключения: ' + err.message
  }
}, { immediate: true })

// Обновляем функцию проверки сети
async function checkNetwork() {
  try {
    if (!walletProvider.value) {
      isCorrectNetwork.value = false
      error.value = 'Провайдер кошелька недоступен'
      return
    }

    const ethersProvider = new BrowserProvider(walletProvider.value)
    const network = await ethersProvider.getNetwork()
    console.log('Текущая сеть:', network.chainId)
    
    isCorrectNetwork.value = Number(network.chainId) === SEPOLIA_CHAIN_ID
    
    if (!isCorrectNetwork.value) {
      error.value = `Пожалуйста, переключитесь на сеть Sepolia (${SEPOLIA_CHAIN_ID}). Текущая сеть: ${network.chainId}`
    } else {
      error.value = ''
      await Promise.all([fetchPrice(), fetchOwner()])
    }
  } catch (err) {
    console.error('Ошибка при проверке сети:', err)
    isCorrectNetwork.value = false
    error.value = 'Ошибка при проверке сети: ' + err.message
  }
}

// Обновляем функцию fetchPrice с обработкой ошибок
async function fetchPrice() {
  try {
    const contract = new Contract(contractAddress, contractABI, provider)
    const price = await contract.price()
    currentPrice.value = price
    console.log('Текущая цена:', formatEther(price), 'ETH')
  } catch (err) {
    console.error('Ошибка при получении цены:', err)
    error.value = `Не удалось получить текущую цену: ${err.message}`
    currentPrice.value = null
  }
}

// Получение адреса владельца
async function fetchOwner() {
  try {
    const contract = new Contract(contractAddress, contractABI, provider)
    contractOwner.value = await contract.owner()
  } catch (err) {
    console.error('Ошибка при получении адреса владельца:', err)
  }
}

// Обновляем onMounted
onMounted(async () => {
  console.log('Компонент смонтирован')
  
  try {
    await initializeContract()
    
    if (provider) {
      const contract = new Contract(contractAddress, contractABI, provider)
      
      contract.on('Purchase', (buyer, amount) => {
        console.log(`Новая покупка: ${amount} единиц от ${buyer}`)
        fetchPrice()
      })
      
      return () => {
        contract.removeAllListeners('Purchase')
      }
    }
  } catch (err) {
    console.error('Ошибка при монтировании компонента:', err)
  }
})

// Добавляем функцию для расчета общей стоимости
function calculateTotalCost() {
  if (!currentPrice.value || !amount.value) return BigInt(0)
  return currentPrice.value * BigInt(amount.value)
}

// Обновляем handlePurchase
async function handlePurchase() {
  if (!amount.value) return
  if (!isCorrectNetwork.value) {
    error.value = 'Пожалуйста, переключитесь на сеть Sepolia'
    return
  }
  
  error.value = ''
  success.value = ''
  
  try {
    isLoading.value = true
    const ethersProvider = new BrowserProvider(walletProvider.value)
    const signer = await ethersProvider.getSigner()
    const contract = new Contract(contractAddress, contractABI, signer)
    
    const totalCost = calculateTotalCost()
    console.log('Общая стоимость:', formatEther(totalCost), 'ETH')

    const tx = await contract.purchase(amount.value, {
      value: totalCost
    })
    console.log('Транзакция отправлена:', tx.hash)
    await tx.wait()
    console.log('Транзакция подтверждена')
    
    amount.value = ''
    success.value = 'Покупка успешно совершена!'
    await fetchPrice()
  } catch (err) {
    console.error('Ошибка при покупке:', err)
    if (err.message.includes('user rejected')) {
      error.value = 'Транзакция отменена пользователем'
    } else {
      error.value = 'Произошла ошибка при совершении покупки: ' + err.message
    }
  } finally {
    isLoading.value = false
  }
}

// Добавляем новые функции
async function handleSetPrice() {
  if (!newPrice.value) return
  error.value = ''
  success.value = ''
  
  try {
    isLoading.value = true
    const ethersProvider = new BrowserProvider(walletProvider.value)
    const signer = await ethersProvider.getSigner()
    const contract = new Contract(contractAddress, contractABI, signer)
    
    const priceInWei = parseEther(newPrice.value.toString())
    const tx = await contract.setPrice(priceInWei)
    await tx.wait()
    
    newPrice.value = ''
    success.value = 'Цена успешно обновлена!'
    await fetchPrice()
  } catch (err) {
    console.error('Ошибка при установке цены:', err)
    error.value = 'Ошибка при установке цены: ' + err.message
  } finally {
    isLoading.value = false
  }
}

async function handleWithdraw() {
  error.value = ''
  success.value = ''
  
  try {
    isLoading.value = true
    const ethersProvider = new BrowserProvider(walletProvider.value)
    const signer = await ethersProvider.getSigner()
    const contract = new Contract(contractAddress, contractABI, signer)
    
    const tx = await contract.withdraw()
    await tx.wait()
    
    success.value = 'Средства успешно выведены!'
  } catch (err) {
    console.error('Ошибка при выводе средств:', err)
    error.value = 'Ошибка при выводе средств: ' + err.message
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.contract-interaction {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.wallet-info {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.contract-controls {
  margin-top: 20px;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.amount-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.purchase-button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.purchase-button:hover:not(:disabled) {
  background-color: #45a049;
}

.purchase-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.error-message {
  color: #dc3545;
  padding: 10px;
  margin: 10px 0;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.price-info {
  margin: 10px 0;
  font-weight: bold;
  color: #2c3e50;
}

.owner-controls {
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.purchase-panel {
  margin-top: 20px;
}

.admin-button {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.admin-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.withdraw-button {
  margin-top: 10px;
  background-color: #6c757d;
}

.withdraw-button:hover:not(:disabled) {
  background-color: #5a6268;
}

.total-cost {
  margin-top: 10px;
  font-size: 0.9em;
  color: #6c757d;
}

.success-message {
  color: #28a745;
  margin-top: 10px;
  font-size: 0.9em;
}

.loading-message {
  color: #6c757d;
  text-align: center;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin: 10px 0;
}

.auth-status {
  margin: 10px 0;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.authenticated {
  color: #28a745;
}

.signout-button {
  padding: 5px 10px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.signout-button:hover {
  background-color: #c82333;
}

.connect-button {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.connect-button:hover {
  background-color: #45a049;
}
</style> 