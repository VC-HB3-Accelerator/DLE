import { ref, computed } from 'vue';
import { ethers } from 'ethers';
import { DLE_ABI, TOKEN_ABI } from '@/utils/dle-abi';

/**
 * Композабл для работы с DLE смарт-контрактом
 * Содержит правильные ABI и функции для взаимодействия с контрактом
 */
export function useDleContract() {
  // Состояние
  const isConnected = ref(false);
  const provider = ref(null);
  const signer = ref(null);
  const contract = ref(null);
  const userAddress = ref(null);
  const chainId = ref(null);

  // Используем общий ABI из utils/dle-abi.js

  /**
   * Подключиться к кошельку
   */
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask не найден. Пожалуйста, установите MetaMask.');
      }

      // Запрашиваем подключение
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Создаем провайдер и подписанта
      provider.value = new ethers.BrowserProvider(window.ethereum);
      signer.value = await provider.value.getSigner();
      userAddress.value = await signer.value.getAddress();
      
      // Получаем информацию о сети
      const network = await provider.value.getNetwork();
      chainId.value = Number(network.chainId);
      
      isConnected.value = true;
      
      console.log('✅ Кошелек подключен:', {
        address: userAddress.value,
        chainId: chainId.value,
        network: network.name
      });

      return {
        success: true,
        address: userAddress.value,
        chainId: chainId.value
      };
    } catch (error) {
      console.error('❌ Ошибка подключения к кошельку:', error);
      isConnected.value = false;
      throw error;
    }
  };

  /**
   * Инициализировать контракт
   */
  const initContract = (contractAddress) => {
    if (!provider.value) {
      throw new Error('Провайдер не инициализирован. Сначала подключите кошелек.');
    }

    contract.value = new ethers.Contract(contractAddress, DLE_ABI, signer.value);
    console.log('✅ DLE контракт инициализирован:', contractAddress);
  };

  /**
   * Проверить баланс токенов пользователя
   */
  const checkTokenBalance = async (contractAddress) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      const balance = await contract.value.balanceOf(userAddress.value);
      const balanceFormatted = ethers.formatEther(balance);
      
      console.log(`💰 Баланс токенов: ${balanceFormatted}`);
      
      return {
        success: true,
        balance: balanceFormatted,
        hasTokens: balance > 0
      };
    } catch (error) {
      console.error('❌ Ошибка проверки баланса:', error);
      return {
        success: false,
        error: error.message,
        balance: '0',
        hasTokens: false
      };
    }
  };

  /**
   * Голосовать за предложение
   */
  const voteOnProposal = async (contractAddress, proposalId, support) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      console.log('🗳️ Начинаем голосование:', { proposalId, support });

      // Проверяем баланс токенов
      const balanceCheck = await checkTokenBalance(contractAddress);
      if (!balanceCheck.hasTokens) {
        throw new Error('У вас нет токенов для голосования');
      }

      // Отправляем транзакцию голосования
      const tx = await contract.value.vote(proposalId, support);
      console.log('📤 Транзакция отправлена:', tx.hash);

      // Ждем подтверждения
      const receipt = await tx.wait();
      console.log('✅ Голосование успешно:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('❌ Ошибка голосования:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = error.message;
      if (error.message.includes('execution reverted')) {
        errorMessage = 'Транзакция отклонена смарт-контрактом. Возможные причины:\n' +
          '• Предложение уже не активно\n' +
          '• Вы уже голосовали за это предложение\n' +
          '• Недостаточно прав для голосования\n' +
          '• Предложение не существует';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Транзакция отклонена пользователем';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Недостаточно средств для оплаты газа';
      }

      return {
        success: false,
        error: errorMessage,
        originalError: error
      };
    }
  };

  /**
   * Исполнить предложение
   */
  const executeProposal = async (contractAddress, proposalId) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      console.log('⚡ Исполняем предложение:', proposalId);

      const tx = await contract.value.executeProposal(proposalId);
      console.log('📤 Транзакция отправлена:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Предложение исполнено:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('❌ Ошибка исполнения предложения:', error);
      return {
        success: false,
        error: error.message,
        originalError: error
      };
    }
  };

  /**
   * Отменить предложение
   */
  const cancelProposal = async (contractAddress, proposalId, reason) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      console.log('❌ Отменяем предложение:', { proposalId, reason });

      const tx = await contract.value.cancelProposal(proposalId, reason);
      console.log('📤 Транзакция отправлена:', tx.hash);

      const receipt = await tx.wait();
      console.log('✅ Предложение отменено:', receipt);

      return {
        success: true,
        transactionHash: tx.hash,
        receipt: receipt
      };
    } catch (error) {
      console.error('❌ Ошибка отмены предложения:', error);
      return {
        success: false,
        error: error.message,
        originalError: error
      };
    }
  };

  /**
   * Получить состояние предложения
   */
  const getProposalState = async (contractAddress, proposalId) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      const state = await contract.value.getProposalState(proposalId);
      
      // 0=Pending, 1=Succeeded, 2=Defeated, 3=Executed, 4=Canceled, 5=ReadyForExecution
      const stateNames = {
        0: 'Pending',
        1: 'Succeeded', 
        2: 'Defeated',
        3: 'Executed',
        4: 'Canceled',
        5: 'ReadyForExecution'
      };

      return {
        success: true,
        state: state,
        stateName: stateNames[state] || 'Unknown'
      };
    } catch (error) {
      console.error('❌ Ошибка получения состояния предложения:', error);
      return {
        success: false,
        error: error.message,
        state: null
      };
    }
  };

  /**
   * Проверить результат предложения
   */
  const checkProposalResult = async (contractAddress, proposalId) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      const result = await contract.value.checkProposalResult(proposalId);
      
      return {
        success: true,
        passed: result.passed,
        quorumReached: result.quorumReached
      };
    } catch (error) {
      console.error('❌ Ошибка проверки результата предложения:', error);
      return {
        success: false,
        error: error.message,
        passed: false,
        quorumReached: false
      };
    }
  };

  /**
   * Получить информацию о DLE
   */
  const getDleInfo = async (contractAddress) => {
    try {
      if (!contract.value) {
        initContract(contractAddress);
      }

      const info = await contract.value.getDLEInfo();
      
      return {
        success: true,
        data: {
          name: info.name,
          symbol: info.symbol,
          location: info.location,
          coordinates: info.coordinates,
          jurisdiction: info.jurisdiction,
          okvedCodes: info.okvedCodes,
          kpp: info.kpp,
          creationTimestamp: info.creationTimestamp,
          isActive: info.isActive
        }
      };
    } catch (error) {
      console.error('❌ Ошибка получения информации о DLE:', error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  // Вычисляемые свойства
  const isWalletConnected = computed(() => isConnected.value);
  const currentUserAddress = computed(() => userAddress.value);
  const currentChainId = computed(() => chainId.value);

  return {
    // Состояние
    isConnected,
    provider,
    signer,
    contract,
    userAddress,
    chainId,
    
    // Вычисляемые свойства
    isWalletConnected,
    currentUserAddress,
    currentChainId,
    
    // Методы
    connectWallet,
    initContract,
    checkTokenBalance,
    voteOnProposal,
    executeProposal,
    cancelProposal,
    getProposalState,
    checkProposalResult,
    getDleInfo
  };
}
