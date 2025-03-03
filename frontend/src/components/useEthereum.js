import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ethers } from 'ethers'

export function useEthereum() {
  const address = ref(null)
  const isConnected = ref(false)
  const chainId = ref(null)
  const provider = ref(null)
  const signer = ref(null)

  // Инициализация при загрузке компонента
  onMounted(async () => {
    // Проверяем, есть ли сохраненное состояние подключения
    const savedAddress = localStorage.getItem('walletAddress')
    const savedConnected = localStorage.getItem('isConnected') === 'true'
    
    if (savedConnected && savedAddress) {
      // Пробуем восстановить подключение
      try {
        await connect()
      } catch (error) {
        console.error('Failed to restore connection:', error)
        // Очищаем сохраненное состояние при ошибке
        localStorage.removeItem('walletAddress')
        localStorage.removeItem('isConnected')
      }
    }
  })

  // Функция для подключения кошелька
  async function connect() {
    try {
      // Проверяем, доступен ли MetaMask
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask не установлен')
      }
      
      // Запрашиваем доступ к аккаунтам
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      if (accounts.length === 0) {
        throw new Error('Нет доступных аккаунтов')
      }
      
      // Устанавливаем адрес
      address.value = accounts[0]
      
      try {
        // Создаем провайдер и signer (для ethers v5)
        provider.value = new ethers.providers.Web3Provider(window.ethereum)
        signer.value = provider.value.getSigner()
        
        // Получаем chainId напрямую из ethereum провайдера
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
        chainId.value = parseInt(chainIdHex, 16).toString()
      } catch (providerError) {
        console.error('Ошибка при создании провайдера:', providerError)
        // Продолжаем выполнение, даже если не удалось получить signer
      }
      
      isConnected.value = true
      
      // Сохраняем информацию о подключении
      localStorage.setItem('walletConnected', 'true')
      localStorage.setItem('walletAddress', address.value)
      
      return address.value
    } catch (error) {
      console.error('Connection error:', error)
      throw error
    }
  }

  // Функция для отключения кошелька
  function disconnect() {
    address.value = null
    isConnected.value = false
    provider.value = null
    signer.value = null
    chainId.value = null
    
    // Очищаем localStorage
    localStorage.removeItem('walletAddress')
    localStorage.removeItem('isConnected')
  }

  // Функция для подписи сообщения
  async function signMessage(message) {
    if (!signer.value) {
      throw new Error('Кошелек не подключен')
    }
    
    return await signer.value.signMessage(message)
  }

  // Обработчик изменения аккаунтов
  async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // Пользователь отключил аккаунт
      address.value = null
      isConnected.value = false
      signer.value = null
    } else {
      // Пользователь сменил аккаунт
      address.value = accounts[0]
      isConnected.value = true
      
      // Обновляем signer
      if (provider.value) {
        signer.value = provider.value.getSigner()
      }
    }
  }

  // Обработчик изменения сети
  function handleChainChanged(chainIdHex) {
    chainId.value = parseInt(chainIdHex, 16).toString()
    window.location.reload()
  }

  // Инициализация при монтировании компонента
  onMounted(() => {
    // Проверяем, есть ли MetaMask
    if (window.ethereum) {
      // Добавляем слушатели событий
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
      window.ethereum.on('disconnect', disconnect)
    }
  })

  // Очистка при размонтировании компонента
  onUnmounted(() => {
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum.removeListener('chainChanged', handleChainChanged)
      window.ethereum.removeListener('disconnect', disconnect)
    }
  })

  return {
    address,
    isConnected,
    chainId,
    provider,
    signer,
    connect,
    disconnect,
    signMessage
  }
} 