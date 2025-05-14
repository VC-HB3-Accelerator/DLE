import { ref, computed } from 'vue';
import axios from 'axios';

/**
 * Composable для работы с сетями блокчейн
 * Предоставляет списки доступных сетей, URL RPC и функции для работы с ними
 */
export default function useBlockchainNetworks() {
  // Список стандартных URL для популярных сетей
  const defaultRpcUrls = {
    ethereum: 'https://mainnet.infura.io/v3/YOUR_API_KEY',
    sepolia: 'https://sepolia.infura.io/v3/YOUR_API_KEY',
    goerli: 'https://goerli.infura.io/v3/YOUR_API_KEY',
    holesky: 'https://holesky.infura.io/v3/YOUR_API_KEY',
    bsc: 'https://bsc-dataseed1.binance.org',
    'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    polygon: 'https://polygon-rpc.com',
    mumbai: 'https://rpc-mumbai.maticvigil.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    'arbitrum-goerli': 'https://goerli-rollup.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    'optimism-goerli': 'https://goerli.optimism.io',
    avalanche: 'https://api.avax.network/ext/bc/C/rpc',
    'avalanche-fuji': 'https://api.avax-test.network/ext/bc/C/rpc',
    gnosis: 'https://rpc.gnosischain.com',
    celo: 'https://forno.celo.org',
    fantom: 'https://rpc.ftm.tools',
    'fantom-testnet': 'https://rpc.testnet.fantom.network',
    harmony: 'https://api.harmony.one',
    metis: 'https://andromeda.metis.io/?owner=1088',
    aurora: 'https://mainnet.aurora.dev',
    cronos: 'https://evm.cronos.org',
    localhost: 'http://localhost:8545',
    ganache: 'http://localhost:7545'
  };

  // Группы сетей для отображения в интерфейсе
  const networkGroups = [
    {
      label: 'Основные сети',
      options: [
        { value: 'ethereum', label: 'Ethereum Mainnet', chainId: 1 },
        { value: 'bsc', label: 'Binance Smart Chain', chainId: 56 },
        { value: 'polygon', label: 'Polygon', chainId: 137 },
        { value: 'arbitrum', label: 'Arbitrum One', chainId: 42161 },
        { value: 'optimism', label: 'Optimism', chainId: 10 },
        { value: 'avalanche', label: 'Avalanche C-Chain', chainId: 43114 },
        { value: 'gnosis', label: 'Gnosis Chain (xDai)', chainId: 100 },
        { value: 'celo', label: 'Celo', chainId: 42220 },
        { value: 'fantom', label: 'Fantom Opera', chainId: 250 },
        { value: 'harmony', label: 'Harmony', chainId: 1666600000 },
        { value: 'metis', label: 'Metis Andromeda', chainId: 1088 },
        { value: 'aurora', label: 'Aurora', chainId: 1313161554 },
        { value: 'cronos', label: 'Cronos', chainId: 25 }
      ]
    },
    {
      label: 'Тестовые сети',
      options: [
        { value: 'sepolia', label: 'Sepolia (Ethereum testnet)', chainId: 11155111 },
        { value: 'goerli', label: 'Goerli (Ethereum testnet)', chainId: 5 },
        { value: 'holesky', label: 'Holesky (Ethereum testnet)', chainId: 17000 },
        { value: 'bsc-testnet', label: 'BSC Testnet', chainId: 97 },
        { value: 'mumbai', label: 'Mumbai (Polygon testnet)', chainId: 80001 },
        { value: 'arbitrum-goerli', label: 'Arbitrum Goerli', chainId: 421613 },
        { value: 'optimism-goerli', label: 'Optimism Goerli', chainId: 420 },
        { value: 'avalanche-fuji', label: 'Avalanche Fuji', chainId: 43113 },
        { value: 'fantom-testnet', label: 'Fantom Testnet', chainId: 4002 }
      ]
    },
    {
      label: 'Локальные сети',
      options: [
        { value: 'localhost', label: 'Localhost (Hardhat)', chainId: 31337 },
        { value: 'ganache', label: 'Ganache', chainId: 1337 }
      ]
    },
    {
      label: 'Другое',
      options: [
        { value: 'custom', label: 'Другая сеть (ввести вручную)', chainId: null }
      ]
    }
  ];
  
  // Создаем плоский список всех сетей для удобного использования в компонентах
  const networks = computed(() => {
    return networkGroups.flatMap(group => group.options);
  });

  // Объект для хранения выбранной сети и пользовательских значений
  const networkEntry = ref({
    networkId: '',
    rpcUrl: '',
    customNetworkId: '',
    customChainId: null
  });

  // Вычисляемое свойство для предложения URL на основе выбранной сети
  const defaultRpcUrlSuggestion = computed(() => {
    if (networkEntry.value.networkId && defaultRpcUrls[networkEntry.value.networkId]) {
      return defaultRpcUrls[networkEntry.value.networkId];
    }
    return '';
  });

  // Функция для использования предложенного URL
  const useDefaultRpcUrl = () => {
    if (defaultRpcUrlSuggestion.value) {
      networkEntry.value.rpcUrl = defaultRpcUrlSuggestion.value;
    }
  };

  // Функция для получения chainId по networkId
  const getChainIdByNetworkId = (networkId) => {
    for (const group of networkGroups) {
      const option = group.options.find(opt => opt.value === networkId);
      if (option) {
        return option.chainId;
      }
    }
    return null;
  };

  // Функция для добавления новой конфигурации сети
  const validateAndPrepareNetworkConfig = () => {
    let networkId = networkEntry.value.networkId;
    const rpcUrl = networkEntry.value.rpcUrl.trim();
    
    // Если выбрана опция "custom", используем пользовательский ID
    if (networkId === 'custom') {
      networkId = networkEntry.value.customNetworkId.trim();
      if (!networkId) {
        return { valid: false, error: 'Пожалуйста, введите пользовательский ID сети' };
      }
    }
    
    if (!networkId || !rpcUrl) {
      return { valid: false, error: 'Пожалуйста, выберите ID Сети и введите RPC URL' };
    }
    
    // Определяем chainId
    let chainId = getChainIdByNetworkId(networkId);
    if (!chainId && networkId === networkEntry.value.customNetworkId) {
      chainId = networkEntry.value.customChainId;
    }
    
    return { 
      valid: true, 
      networkConfig: { 
        networkId, 
        rpcUrl,
        chainId 
      } 
    };
  };

  // Функция сброса формы
  const resetNetworkEntry = () => {
    networkEntry.value.networkId = '';
    networkEntry.value.rpcUrl = '';
    networkEntry.value.customNetworkId = '';
    networkEntry.value.customChainId = null;
  };

  // Функция получения списка всех доступных сетей в плоском формате
  const getAllNetworks = () => {
    return networks.value;
  };

  // Функция получения метаданных сети по ID
  const getNetworkMetadata = (networkId) => {
    return networks.value.find(network => network.value === networkId) || null;
  };

  // Состояние для тестирования RPC
  const testingRpc = ref(false);
  const testingRpcId = ref('');

  // Функция для тестирования RPC-соединения
  const testRpcConnection = async (networkId, rpcUrl) => {
    testingRpc.value = true;
    testingRpcId.value = networkId;
    
    try {
      // Формируем запрос на бэкенд для проверки RPC
      const response = await axios.post('/api/settings/rpc-test', { 
        networkId,
        rpcUrl
      });
      
      if (response.data && response.data.success) {
        return {
          success: true,
          message: `Соединение с ${networkId} успешно установлено! Номер блока: ${response.data.blockNumber}`,
          blockNumber: response.data.blockNumber
        };
      } else {
        return {
          success: false,
          error: response.data?.error || 'Не удалось установить соединение'
        };
      }
    } catch (error) {
      console.error('[useBlockchainNetworks] Ошибка при тестировании RPC:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Неизвестная ошибка'
      };
    } finally {
      testingRpc.value = false;
      testingRpcId.value = '';
    }
  };

  return {
    // Данные
    defaultRpcUrls,
    networkGroups,
    networkEntry,
    defaultRpcUrlSuggestion,
    testingRpc,
    testingRpcId,
    networks, // Экспортируем плоский список сетей
    
    // Методы
    useDefaultRpcUrl,
    getChainIdByNetworkId,
    validateAndPrepareNetworkConfig,
    resetNetworkEntry,
    getAllNetworks,
    getNetworkMetadata,
    testRpcConnection
  };
} 