/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import api from '@/api/axios';
import { ethers } from 'ethers';
import { DLE_ABI, DLE_DEACTIVATION_ABI, TOKEN_ABI } from './dle-abi';
import { i18n } from '@/locales/index.js';
import { candidateModuleIds, getCanonicalModuleId } from '@/constants/moduleIds';

const t = (key, params) => i18n.global.t(key, params);

const ERR_PROPOSAL_EXECUTED = '0x2d686f73';

const PROPOSAL_REVERT_I18N = {
  '0xe7005635': 'smartcontracts.proposals.composableErrors.voteErrAlreadyVoted',
  '0x21c19873': 'smartcontracts.proposals.composableErrors.voteErrNoPower',
  '0x834d7b85': 'smartcontracts.proposals.composableErrors.voteErrProposalMissing',
  '0xd6792fad': 'smartcontracts.proposals.composableErrors.voteErrProposalEnded',
  '0x2d686f73': 'smartcontracts.proposals.composableErrors.voteErrProposalExecuted',
  '0xc7567e07': 'smartcontracts.proposals.composableErrors.voteErrProposalCanceled',
  '0x2eaf0f6d': 'smartcontracts.proposals.composableErrors.voteErrWrongChain',
  '0x165a8e03': 'smartcontracts.proposals.composableErrors.voteErrUnsupportedChain',
  '0x3eb107b3': 'smartcontracts.proposals.composableErrors.executeErrAlreadyExecutedInChain',
  '0x4e395b85': 'smartcontracts.proposals.composableErrors.executeErrNotReady',
  '0x64831a1b': 'smartcontracts.proposals.composableErrors.executeErrBadTarget',
  '0x9c3d2799': 'smartcontracts.proposals.composableErrors.executeErrInvalidOperation',
};

const HAS_VOTED_ABI = ['function hasVoted(uint256 proposalId, address voter) view returns (bool)'];

function extractRevertSelector(error) {
  const candidates = [
    error?.data,
    error?.info?.error?.data,
    error?.error?.data,
    error?.revert?.data,
  ];
  for (const raw of candidates) {
    let hex = raw;
    if (raw && typeof raw === 'object' && typeof raw.data === 'string') hex = raw.data;
    if (typeof hex === 'string' && hex.startsWith('0x') && hex.length >= 10) {
      return hex.slice(0, 10).toLowerCase();
    }
  }
  return '';
}

export function messageForProposalRevert(error) {
  const sel = extractRevertSelector(error);
  const key = PROPOSAL_REVERT_I18N[sel];
  return key ? t(key) : null;
}

export function messageForVoteRevert(error) {
  return messageForProposalRevert(error);
}

/**
 * Есть ли модуль уже в слоте книги (канонический или legacy ID).
 */
export async function findBookedModuleId(dleAddress, moduleType, chainId) {
  if (!window.ethereum || !moduleType) return null;
  if (chainId) {
    const switched = await switchToVotingNetwork(chainId);
    if (!switched) return null;
  }
  const provider = new ethers.BrowserProvider(window.ethereum);
  const dle = new ethers.Contract(
    dleAddress,
    [
      'function getModuleAddress(bytes32) view returns (address)',
      'function activeModules(bytes32) view returns (bool)',
    ],
    provider
  );
  for (const id of candidateModuleIds(moduleType)) {
    try {
      const addr = await dle.getModuleAddress(id);
      if (addr && addr !== ethers.ZeroAddress) return id;
      if (await dle.activeModules(id)) return id;
    } catch (_) {
      // следующий кандидат
    }
  }
  return null;
}

const MODULE_BRIDGE_VIEW_ABI = [
  'function getModuleAddress(bytes32) view returns (address)',
  'function initializer() view returns (address)',
];
const HV_BRIDGE_ABI = [
  'function moduleBridge() view returns (address)',
  'function setModuleBridge(address bridge)',
];

/**
 * Адрес модуля в слоте книги (текущая сеть кошелька).
 */
export async function getBookedModuleAddress(dleAddress, moduleType, chainId) {
  const moduleId = await findBookedModuleId(dleAddress, moduleType, chainId);
  if (!moduleId || !window.ethereum) return null;
  const provider = new ethers.BrowserProvider(window.ethereum);
  const dle = new ethers.Contract(dleAddress, MODULE_BRIDGE_VIEW_ABI, provider);
  const addr = await dle.getModuleAddress(moduleId);
  if (!addr || addr === ethers.ZeroAddress) return null;
  return addr;
}

export async function readHvModuleBridge(hvAddress) {
  if (!window.ethereum || !hvAddress) return ethers.ZeroAddress;
  const provider = new ethers.BrowserProvider(window.ethereum);
  const hv = new ethers.Contract(hvAddress, HV_BRIDGE_ABI, provider);
  return await hv.moduleBridge();
}

/**
 * Первая привязка HV.opsBridge. Не предложение: книга не вызывает setModuleBridge
 * через _callModuleBridge, пока moduleBridge() == 0. Только initializer или DLE.
 */
export async function attachHvBridgeByInitializer(bookAddress, hvAddress, bridgeAddress) {
  if (!window.ethereum) {
    throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
  }
  if (!ethers.isAddress(hvAddress) || !ethers.isAddress(bridgeAddress)) {
    throw new Error(t('smartcontracts.moduleBridgeOp.invalidAddress'));
  }
  if (bridgeAddress === ethers.ZeroAddress) {
    throw new Error(t('smartcontracts.moduleBridgeOp.zeroAddress'));
  }

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const wallet = await signer.getAddress();
  const dle = new ethers.Contract(bookAddress, MODULE_BRIDGE_VIEW_ABI, provider);
  const initializer = await dle.initializer();
  if (wallet.toLowerCase() !== String(initializer).toLowerCase()) {
    throw new Error(t('smartcontracts.moduleBridgeOp.notInitializer', {
      initializer,
      wallet,
    }));
  }

  const hvRead = new ethers.Contract(hvAddress, HV_BRIDGE_ABI, provider);
  const current = await hvRead.moduleBridge();
  if (current && current !== ethers.ZeroAddress) {
    throw new Error(t('smartcontracts.moduleBridgeOp.alreadyWired', { bridge: current }));
  }

  const hv = new ethers.Contract(hvAddress, HV_BRIDGE_ABI, signer);
  const tx = await hv.setModuleBridge(bridgeAddress);
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt.blockNumber };
}

export { getCanonicalModuleId };

// Функция для переключения сети кошелька
export async function switchToVotingNetwork(chainId) {
  try {
    // Преобразуем chainId в строку для поиска в объекте networks
    const chainIdStr = String(chainId);
    console.log(`🔄 [NETWORK] Пытаемся переключиться на сеть ${chainId} (строка: ${chainIdStr})...`);
    
    // Конфигурации сетей
    const networks = {
      '1': {
        chainId: '0x1',
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://ethereum.publicnode.com'],
        blockExplorerUrls: ['https://etherscan.io']
      },
      '11155111': { // Sepolia
        chainId: '0xaa36a7',
        chainName: 'Sepolia',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://1rpc.io/sepolia'],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      },
      '17000': { // Holesky
        chainId: '0x4268',
        chainName: 'Holesky',
        nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://ethereum-holesky.publicnode.com'],
        blockExplorerUrls: ['https://holesky.etherscan.io']
      },
      '421614': { // Arbitrum Sepolia
        chainId: '0x66eee',
        chainName: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Arbitrum Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://sepolia.arbiscan.io']
      },
      '84532': { // Base Sepolia
        chainId: '0x14a34',
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Base Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia.base.org'],
        blockExplorerUrls: ['https://sepolia.basescan.org']
      }
    };
    
    const networkConfig = networks[chainIdStr];
    if (!networkConfig) {
      console.error(`❌ [NETWORK] Неизвестная сеть: ${chainId} (строка: ${chainIdStr})`);
      console.error(`❌ [NETWORK] Доступные сети:`, Object.keys(networks));
      return false;
    }
    
    // Проверяем, подключена ли уже нужная сеть
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log(`🔍 [NETWORK] Текущая сеть: ${currentChainId}, нужная: ${networkConfig.chainId}`);
    if (currentChainId === networkConfig.chainId) {
      console.log(`✅ [NETWORK] Сеть ${chainIdStr} уже подключена`);
      return true;
    }
    
    // Пытаемся переключиться на нужную сеть
    try {
      console.log(`🔄 [NETWORK] Запрашиваем переключение на сеть ${chainIdStr}...`);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: networkConfig.chainId }]
      });
      console.log(`✅ [NETWORK] Успешно переключились на сеть ${chainIdStr}`);
      return true;
    } catch (switchError) {
      console.error(`⚠️ [NETWORK] Ошибка переключения:`, switchError);
      // Если сеть не добавлена, добавляем её
      if (switchError.code === 4902) {
        console.log(`➕ [NETWORK] Добавляем сеть ${chainIdStr}...`);
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig]
          });
          console.log(`✅ [NETWORK] Сеть ${chainIdStr} добавлена и подключена`);
          return true;
        } catch (addError) {
          console.error(`❌ [NETWORK] Ошибка добавления сети ${chainIdStr}:`, addError);
          return false;
        }
      } else {
        console.error(`❌ [NETWORK] Ошибка переключения на сеть ${chainIdStr}:`, switchError);
        return false;
      }
    }
  } catch (error) {
    console.error(`❌ [NETWORK] Общая ошибка переключения сети ${chainIdStr}:`, error);
    return false;
  }
}

/**
 * Проверить подключение к браузерному кошельку
 * @returns {Promise<Object>} - Информация о подключенном кошельке
 */
export async function checkWalletConnection() {
  try {
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    return {
      connected: true,
      address: address,
      chainId: Number(network.chainId),
      provider: window.ethereum.isMetaMask ? 'MetaMask' : 'Other Wallet'
    };
  } catch (error) {
    console.error('Ошибка подключения к кошельку:', error);
    
    // Улучшенная обработка ошибок MetaMask
    let errorMessage = t('dleContract.errors.walletConnectionError');
    
    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = t('dleContract.errors.metamaskExtensionNotFound');
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = t('dleContract.errors.metamaskConnectFailed');
    } else if (error.message && error.message === t('dleContract.errors.browserWalletNotInstalled')) {
      errorMessage = t('dleContract.errors.browserWalletNotInstalledWithHint');
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Утилита для работы с реальными функциями смарт-контракта DLE
 * Используется только система голосования (proposals)
 */



/**
 * Получить информацию о DLE из блокчейна
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Информация о DLE
 */
export async function getDLEInfo(dleAddress) {
  try {
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.readBlockchainFailed'));
    }
  } catch (error) {
    console.error('Ошибка получения информации о DLE:', error);
    throw error;
  }
}

/**
 * Загружает данные DLE из блокчейна (алиас для getDLEInfo)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Данные DLE из блокчейна
 */
export async function loadDleDataFromBlockchain(dleAddress) {
  return getDLEInfo(dleAddress);
}

/**
 * Создать новое предложение для голосования через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {Object} proposalData - Данные предложения
 * @returns {Promise<Object>} - Результат создания
 */
export async function createProposal(dleAddress, proposalData) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Создаем предложение
    // Правильный порядок параметров: description, duration, operation, targetChains, timelockDelay
    const tx = await dle.createProposal(
      proposalData.description,
      proposalData.duration,
      proposalData.operation,
      proposalData.targetChains || [],
      proposalData.timelockDelay || 0
    );

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение создано, tx hash:', tx.hash);

    return {
      success: true,
      proposalId: receipt.logs[0]?.topics[1] || '0', // Извлекаем ID предложения из события
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка создания предложения:', error);
    throw error;
  }
}

/**
 * Минимальный ABI только для чтения делегации (DLE_ABI без view ломает eth_call).
 */
const DELEGATION_READ_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function delegates(address account) view returns (address)',
];

const DELEGATE_WRITE_ABI = [
  'function delegate(address delegatee)',
];

async function resolveConnectedWalletAddress(preferredAddress) {
  if (preferredAddress) return preferredAddress;
  if (!window.ethereum) return null;
  const accounts = await window.ethereum.request({ method: 'eth_accounts' });
  return accounts?.[0] || null;
}

/**
 * Проверить, нужна ли самоделегация голосов (ERC20Votes).
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} userAddress - Адрес кошелька
 * @returns {Promise<{ needsDelegation: boolean, balance: bigint, delegate: string }>}
 */
export async function getDelegationStatus(dleAddress, userAddress) {
  const empty = { needsDelegation: false, balance: 0n, delegate: ethers.ZeroAddress };
  const wallet = await resolveConnectedWalletAddress(userAddress);
  if (!window.ethereum || !dleAddress || !wallet) {
    return empty;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const dle = new ethers.Contract(dleAddress, DELEGATION_READ_ABI, provider);
  const balance = await dle.balanceOf.staticCall(wallet);
  const delegate = await dle.delegates.staticCall(wallet);
  const self = ethers.getAddress(wallet);
  const needsDelegation = balance > 0n && ethers.getAddress(delegate) !== self;

  return { needsDelegation, balance, delegate };
}

/**
 * Делегировать голоса себе (обязательно для getPastVotes / голосования).
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number|string} [chainId] - Сеть DLE (переключит кошелёк при необходимости)
 * @returns {Promise<{ txHash: string, blockNumber: number }>}
 */
export async function delegateVotingPowerToSelf(dleAddress, chainId) {
  if (!window.ethereum) {
    throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
  }

  if (chainId) {
    await switchToVotingNetwork(chainId);
  }

  let accounts = await window.ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const self = await signer.getAddress();
  const dle = new ethers.Contract(dleAddress, DELEGATE_WRITE_ABI, signer);

  const status = await getDelegationStatus(dleAddress, self);
  if (!status.needsDelegation) {
    return { txHash: null, blockNumber: null, alreadyDelegated: true };
  }

  const tx = await dle.delegate(self);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    alreadyDelegated: false
  };
}

/**
 * Голосовать за предложение через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {boolean} support - Поддержка предложения
 * @returns {Promise<Object>} - Результат голосования
 */
export async function voteForProposal(dleAddress, proposalId, support, chainId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    if (chainId) {
      const switched = await switchToVotingNetwork(chainId);
      if (!switched) {
        throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
          networkName: String(chainId),
          chainId,
        }));
      }
      const hexAfter = await window.ethereum.request({ method: 'eth_chainId' });
      const actualChainId = parseInt(hexAfter, 16);
      if (actualChainId !== Number(chainId)) {
        throw new Error(t('smartcontracts.proposals.composableErrors.wrongNetwork', {
          currentChainId: actualChainId,
          requiredChainId: Number(chainId),
        }));
      }
    }

    let accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const voter = await signer.getAddress();

    const votedReader = new ethers.Contract(dleAddress, HAS_VOTED_ABI, provider);
    try {
      const alreadyVoted = await votedReader.hasVoted.staticCall(proposalId, voter);
      if (alreadyVoted) {
        throw new Error(t('smartcontracts.proposals.composableErrors.voteErrAlreadyVoted'));
      }
    } catch (precheckError) {
      if (String(precheckError?.message || '').includes(
        t('smartcontracts.proposals.composableErrors.voteErrAlreadyVoted')
      )) {
        throw precheckError;
      }
    }

    // Используем общий ABI
    let dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Дополнительная диагностика перед голосованием
    try {
      console.log('🔍 [VOTE DEBUG] Проверяем состояние предложения...');
      const proposalState = await dle.getProposalState(proposalId);
      console.log('🔍 [VOTE DEBUG] Состояние предложения:', proposalState);
      
      // Проверяем, можно ли голосовать (состояние должно быть 0 = Pending)
      if (Number(proposalState) !== 0) {
        throw new Error(t('dleContract.errors.proposalWrongState', { state: proposalState }));
      }
      
      console.log('🔍 [VOTE DEBUG] Предложение в правильном состоянии для голосования');
      
      // Проверяем право голоса (если доступно)
      try {
        const proposal = await dle.proposals(proposalId);
        if (proposal.snapshotTimepoint) {
          const votingPower = await dle.getPastVotes(signer.address, proposal.snapshotTimepoint);
          console.log('🔍 [VOTE DEBUG] Право голоса:', votingPower.toString());
          if (votingPower === 0n) {
            throw new Error(t('dleContract.errors.noVotingPower'));
          }
          console.log('🔍 [VOTE DEBUG] У пользователя есть право голоса');
        }
      } catch (votingPowerError) {
        if (String(votingPowerError?.message || '').includes(t('dleContract.errors.noVotingPower'))
          || /votingPower = 0|ErrNoPower|нет права голоса/i.test(String(votingPowerError?.message || ''))) {
          throw votingPowerError;
        }
        console.warn('⚠️ [VOTE DEBUG] Не удалось проверить право голоса (продолжаем):', votingPowerError.message);
      }
      
    } catch (debugError) {
      const msg = String(debugError?.message || '');
      if (
        msg.includes(t('dleContract.errors.noVotingPower'))
        || /votingPower = 0|ErrNoPower|нет права голоса|состоянии/i.test(msg)
      ) {
        throw debugError;
      }
      console.warn('⚠️ [VOTE DEBUG] Ошибка диагностики (продолжаем):', debugError.message);
    }

    // Голос: транзакцию шлёт кошелёк держателя. Служебного ключа на ОС нет; казна газ не возвращает.
    const tx = await dle.vote(proposalId, support);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Голосование выполнено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

    } catch (error) {
      console.error('Ошибка голосования:', error);
      const mapped = messageForVoteRevert(error);
      if (mapped) {
        const wrapped = new Error(mapped);
        wrapped.revertSelector = extractRevertSelector(error);
        throw wrapped;
      }
      throw error;
    }
}

/**
 * Исполнить предложение через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeProposal(dleAddress, proposalId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    try {
      await dle.executeProposal.staticCall(proposalId);
    } catch (precheckError) {
      const mapped = messageForProposalRevert(precheckError);
      if (mapped) throw new Error(mapped);
      throw precheckError;
    }

    // Исполняем предложение
    const tx = await dle.executeProposal(proposalId);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение исполнено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка исполнения предложения:', error);
    const mapped = messageForProposalRevert(error);
    if (mapped) throw new Error(mapped);
    throw error;
  }
}

/**
 * Отменить предложение
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {string} reason - Причина отмены
 * @returns {Promise<Object>} - Результат отмены
 */
export async function cancelProposal(dleAddress, proposalId, reason) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Отменяем предложение
    const tx = await dle.cancelProposal(proposalId, reason);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение отменено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('Ошибка отмены предложения:', error);
    throw error;
  }
}

/**
 * Проверить баланс токенов пользователя
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Баланс токенов
 */
export async function checkTokenBalance(dleAddress, userAddress) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Создаем провайдер (только для чтения)
    const provider = new ethers.BrowserProvider(window.ethereum);
    const dle = new ethers.Contract(dleAddress, DLE_ABI, provider);

    // Получаем баланс токенов
    const balance = await dle.balanceOf(userAddress);
    const balanceFormatted = ethers.formatEther(balance);
    
    console.log(`💰 Баланс токенов для ${userAddress}: ${balanceFormatted}`);

    return {
      balance: balanceFormatted,
      hasTokens: balance > 0,
      rawBalance: balance.toString()
    };
  } catch (error) {
    console.error('Ошибка проверки баланса токенов:', error);
    throw error;
  }
}

/**
 * Создать предложение о добавлении модуля (с автоматической оплатой газа)
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {string} moduleId - ID модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID цепочки для голосования
 * @param {string} deploymentId - ID деплоя для получения приватного ключа (опционально)
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createAddModuleProposal(dleAddress, description, duration, moduleId, moduleAddress, chainId) {
  try {
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }
    if (chainId) {
      const switched = await switchToVotingNetwork(chainId);
      if (!switched) {
        throw new Error(t('dleContract.errors.createAddModuleProposalFailed'));
      }
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);
    const tx = await dle.createAddModuleProposal(
      description,
      duration,
      moduleId,
      moduleAddress,
      chainId
    );
    const receipt = await tx.wait();
    return {
      proposalId: receipt.logs[0]?.topics[1] || '0',
      transactionHash: tx.hash,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString?.(),
    };
  } catch (error) {
    console.error('Ошибка создания предложения о добавлении модуля:', error);
    if (extractRevertSelector(error) === ERR_PROPOSAL_EXECUTED) {
      throw new Error(t('dleContract.errors.moduleAlreadyInBook'));
    }
    throw error;
  }
}

/**
 * Создать предложение об удалении модуля
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {string} moduleId - ID модуля
 * @param {number} chainId - ID цепочки для голосования
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createRemoveModuleProposal(dleAddress, description, duration, moduleId, chainId) {
  try {
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }
    if (chainId) {
      const switched = await switchToVotingNetwork(chainId);
      if (!switched) {
        throw new Error(t('dleContract.errors.createRemoveModuleProposalFailed'));
      }
    }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);
    const tx = await dle.createRemoveModuleProposal(description, duration, moduleId, chainId);
    const receipt = await tx.wait();
    return {
      proposalId: receipt.logs[0]?.topics[1] || '0',
      transactionHash: tx.hash,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('Ошибка создания предложения об удалении модуля:', error);
    throw error;
  }
}

/**
 * Проверить, активен ли модуль
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} moduleId - ID модуля
 * @returns {Promise<boolean>} - Активен ли модуль
 */
export async function isModuleActive(dleAddress, moduleId) {
  try {
    const response = await api.post('/dle-modules/is-module-active', {
      dleAddress: dleAddress,
      moduleId: moduleId
    });
    
    if (response.data.success) {
      return response.data.data.isActive;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.moduleActiveCheckFailed'));
    }
  } catch (error) {
    console.error('Ошибка проверки активности модуля:', error);
    return false;
  }
}

/**
 * Получить адрес модуля
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} moduleId - ID модуля
 * @returns {Promise<string>} - Адрес модуля
 */
export async function getModuleAddress(dleAddress, moduleId, chainId) {
  try {
    const response = await api.post('/dle-modules/get-module-address', {
      dleAddress: dleAddress,
      moduleId: moduleId,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data.moduleAddress;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.moduleAddressFailed'));
    }
  } catch (error) {
    console.error('Ошибка получения адреса модуля:', error);
    return '';
  }
}

/**
 * Проверить, поддерживается ли цепочка
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} chainId - ID цепочки
 * @returns {Promise<boolean>} - Поддерживается ли цепочка
 */
export async function isChainSupported(dleAddress, chainId) {
  try {
    const response = await api.post('/blockchain/is-chain-supported', {
      dleAddress: dleAddress,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data.isSupported;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.chainSupportCheckFailed'));
    }
  } catch (error) {
    console.error('Ошибка проверки поддержки цепочки:', error);
    return false;
  }
}

/**
 * Получить текущий ID цепочки
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<number>} - Текущий ID цепочки
 */
export async function getCurrentChainId(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-current-chain-id', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.chainId;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.currentChainIdFailed'));
    }
  } catch (error) {
    console.error('Ошибка получения текущего ID цепочки:', error);
    return 0;
  }
}

/**
 * Проверить результат предложения
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат проверки
 */
export async function checkProposalResult(dleAddress, proposalId) {
  try {
    const response = await api.post('/blockchain/check-proposal-result', {
      dleAddress: dleAddress,
      proposalId: proposalId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.proposalResultCheckFailed'));
    }
  } catch (error) {
    console.error('Ошибка проверки результата предложения:', error);
    return { passed: false, quorumReached: false };
  }
}

// Заглушки для совместимости с существующими компонентами
// Эти функции не существуют в реальном контракте, но используются в UI

/**
 * Загружает предложения DLE из блокчейна
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список предложений
 */
export async function loadProposals(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-proposals', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.proposals;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.loadProposalsFailed'));
    }
  } catch (error) {
    console.error('Ошибка загрузки предложений:', error);
    return [];
  }
}

/**
 * Загружает держателей токенов DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список держателей токенов
 */
export async function loadTokenHolders(dleAddress) {
  try {
    // В реальности нужно сканировать события Transfer из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки держателей токенов:', error);
    return [];
  }
}

/**
 * Загружает историю операций DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список операций
 */
export async function loadHistory(dleAddress) {
  try {
    // В реальности нужно читать все события из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
    return [];
  }
}

/**
 * Загружает активы казны DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список активов
 */
export async function loadTreasuryAssets(dleAddress) {
  try {
    // В реальности нужно читать балансы токенов из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки активов казны:', error);
    return [];
  }
}

/**
 * Загружает аналитику DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Данные аналитики
 */
export async function loadAnalytics(dleAddress) {
  try {
    // В реальности нужно агрегировать данные из блокчейна
    return {
      topParticipants: [],
      totalSupply: 0,
      participantCount: 0,
      activeProposals: 0
    };
  } catch (error) {
    console.error('Ошибка загрузки аналитики:', error);
    return {
      topParticipants: [],
      totalSupply: 0,
      participantCount: 0,
      activeProposals: 0
    };
  }
}

/**
 * Получить поддерживаемые цепочки из смарт-контракта
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список поддерживаемых цепочек
 */
export async function getSupportedChains(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-supported-chains', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.chains;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.supportedChainsFailed'));
    }
  } catch (error) {
    console.error('Ошибка получения поддерживаемых цепочек:', error);
    // Возвращаем пустой массив если API недоступен
    return [];
  }
}

/**
 * Деактивировать DLE (только при достижении кворума)
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат деактивации
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function deactivateDLE(dleAddress, userAddress) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Проверяем, что подключенный адрес совпадает с userAddress
    const connectedAddress = await signer.getAddress();
    if (connectedAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error(t('dleContract.errors.walletAddressMismatch'));
    }

    // Сначала проверяем возможность деактивации через API
    console.log('Проверяем возможность деактивации DLE через API...');
    const checkResponse = await api.post('/blockchain/deactivate-dle', {
      dleAddress: dleAddress,
      userAddress: userAddress
    });

    if (!checkResponse.data.success) {
      throw new Error(checkResponse.data.error || t('dleContract.errors.deactivationCheckFailed'));
    }

    console.log('Проверка деактивации прошла успешно, выполняем деактивацию...');

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Дополнительные проверки перед деактивацией
    const balance = await dle.balanceOf(userAddress);
    if (balance <= 0) {
      throw new Error(t('dleContract.errors.tokensRequiredForDeactivation'));
    }

    const totalSupply = await dle.totalSupply();
    if (totalSupply <= 0) {
      throw new Error(t('dleContract.errors.dleNoTokens'));
    }

    const isActive = await dle.isActive();
    if (!isActive) {
      throw new Error(t('dleContract.errors.dleAlreadyDeactivated'));
    }

    // Выполняем деактивацию
    console.log('Выполняем деактивацию DLE...');
    const tx = await dle.deactivate();
    const receipt = await tx.wait();

    console.log('DLE деактивирован, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'DLE успешно деактивирован'
    };

  } catch (error) {
    console.error('Ошибка деактивации DLE:', error);
    
    // Улучшенная обработка ошибок
    let errorMessage = t('dleContract.errors.deactivationError');
    
    if (error.message.includes('execution reverted')) {
      errorMessage = t('dleContract.errors.deactivationNotPossible');
    } else if (error.message.includes('владелец') || error.message.includes('owner')) {
      errorMessage = t('dleContract.errors.deactivationOwnerOnly');
    } else if (error.message.includes('кошелек') || error.message.includes('wallet')) {
      errorMessage = t('dleContract.errors.walletRequired');
    } else if (error.message.includes('деактивирован') || error.message.includes('deactivated')) {
      errorMessage = t('dleContract.errors.dleAlreadyDeactivatedWithEmoji');
    } else if (error.message.includes('токены') || error.message.includes('token')) {
      errorMessage = t('dleContract.errors.tokensRequiredWithEmoji');
    } else {
      errorMessage = t('dleContract.errors.genericError', { message: error.message });
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Создать предложение о деактивации DLE
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {number} chainId - ID цепочки для деактивации
 * @returns {Promise<Object>} - Результат создания предложения
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function createDeactivationProposal(dleAddress, description, duration, chainId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.createDeactivationProposal(description, duration, chainId);
    const receipt = await tx.wait();

    console.log('Предложение о деактивации создано, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: t('dleContract.messages.deactivationProposalCreated')
    };

  } catch (error) {
    console.error('Ошибка создания предложения о деактивации:', error);
    throw error;
  }
}

/**
 * Голосовать за предложение деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {boolean} support - Поддержка предложения
 * @returns {Promise<Object>} - Результат голосования
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function voteDeactivationProposal(dleAddress, proposalId, support) {
  try {
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.voteDeactivation(proposalId, support);
    const receipt = await tx.wait();

    console.log('Голосование за предложение деактивации, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: support ? t('dleContract.messages.deactivationVoteFor') : t('dleContract.messages.deactivationVoteAgainst')
    };

  } catch (error) {
    console.error('Ошибка голосования за предложение деактивации:', error);
    throw error;
  }
}

/**
 * Проверить результат предложения деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат проверки
 */
export async function checkDeactivationProposalResult(dleAddress, proposalId) {
  try {
    const response = await api.post('/blockchain/check-deactivation-proposal-result', {
      dleAddress: dleAddress,
      proposalId: proposalId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.deactivationProposalResultFailed'));
    }
  } catch (error) {
    console.error('Ошибка проверки результата предложения деактивации:', error);
    throw error;
  }
}

/**
 * Исполнить предложение деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат исполнения
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function executeDeactivationProposal(dleAddress, proposalId) {
  try {
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.executeDeactivationProposal(proposalId);
    const receipt = await tx.wait();

    console.log('Предложение деактивации исполнено, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: t('dleContract.messages.deactivationProposalExecuted')
    };

  } catch (error) {
    console.error('Ошибка исполнения предложения деактивации:', error);
    throw error;
  }
}

/**
 * Загрузить предложения деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список предложений деактивации
 */
export async function loadDeactivationProposals(dleAddress) {
  try {
    const response = await api.post('/blockchain/load-deactivation-proposals', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.proposals;
    } else {
      throw new Error(response.data.message || t('dleContract.errors.loadDeactivationProposalsFailed'));
    }
  } catch (error) {
    console.error('Ошибка загрузки предложений деактивации:', error);
    return [];
  }
} 

/**
 * Создать предложение о переводе токенов через governance
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {Object} transferData - Данные перевода
 * @param {string} transferData.recipient - Адрес получателя
 * @param {number} transferData.amount - Количество токенов
 * @param {string} transferData.description - Описание предложения
 * @param {number} transferData.duration - Длительность голосования в секундах
 * @param {Array<number>} transferData.targetChains - Целевые сети для исполнения
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createTransferTokensProposal(dleAddress, transferData) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error(t('dleContract.errors.browserWalletNotInstalled'));
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Получаем адрес отправителя (инициатора предложения)
    const senderAddress = await signer.getAddress();

    // Кодируем операцию перевода токенов
    // Правильная сигнатура: _transferTokens(address,address,uint256)
    // Параметры: sender (инициатор), recipient (получатель), amount (в wei)
    const functionSignature = '_transferTokens(address,address,uint256)';
    const iface = new ethers.Interface([`function ${functionSignature}`]);
    const operation = iface.encodeFunctionData('_transferTokens', [
      senderAddress,      // адрес инициатора
      transferData.recipient,   // адрес получателя
      ethers.parseUnits(transferData.amount.toString(), 18) // количество в wei
    ]);

    console.log('Создание предложения о переводе токенов:', {
      recipient: transferData.recipient,
      amount: transferData.amount,
      description: transferData.description,
      operation: operation
    });

    // Создаем предложение
    // Правильный порядок параметров: description, duration, operation, targetChains, timelockDelay
    const tx = await dle.createProposal(
      transferData.description,
      transferData.duration,
      operation,
      transferData.targetChains || [],
      0 // timelockDelay
    );

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение о переводе токенов создано, tx hash:', tx.hash);

    return {
      proposalId: receipt.logs[0]?.topics[1] || '0', // Извлекаем ID предложения из события
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка создания предложения о переводе токенов:', error);
    throw error;
  }
}

const MODULE_BRIDGE_OPS = {
  treasury: {
    setHierarchicalVotingModule: 'function setHierarchicalVotingModule(address module)',
    setFundsBridge: 'function setFundsBridge(address bridge)',
    transferFunds: 'function transferFunds(address tokenAddress, address recipient, uint256 amount, bytes32 proposalId)',
    transferERC721: 'function transferERC721(address nftContract, address recipient, uint256 tokenId, bytes32 proposalId)',
    transferERC1155: 'function transferERC1155(address nftContract, address recipient, uint256 tokenId, uint256 amount, bytes32 proposalId)',
    addToken: 'function addToken(address tokenAddress, string symbol, uint8 decimals)',
    removeToken: 'function removeToken(address tokenAddress)',
    setTokenStatus: 'function setTokenStatus(address tokenAddress, bool isActive)',
  },
  hierarchicalVoting: {
    setTreasuryModule: 'function setTreasuryModule(address _treasuryModule)',
    setModuleBridge: 'function setModuleBridge(address bridge)',
    addExternalDLE: 'function addExternalDLE(address dleAddress, string name, string symbol)',
    removeExternalDLE: 'function removeExternalDLE(address dleAddress)',
    updateExternalDLEBalance: 'function updateExternalDLEBalance(address dleAddress)',
    updateAllExternalDLEBalances: 'function updateAllExternalDLEBalances()',
  },
};

/**
 * Предложение: DLE._callModuleBridge(moduleId, innerCall) → мост модуля.
 */
export function encodeCallModuleBridgeOperation(moduleType, functionName, moduleId, argAddress) {
  return encodeModuleBridgeOperation(moduleType, functionName, moduleId, {
    targetAddress: argAddress,
    address: argAddress,
  });
}

/**
 * Encode DLE._callModuleBridge for any MODULE_BRIDGE_OPS entry.
 * @param {string} moduleType
 * @param {string} functionName
 * @param {string} moduleId bytes32
 * @param {object} args
 */
export function encodeModuleBridgeOperation(moduleType, functionName, moduleId, args = {}) {
  const signature = MODULE_BRIDGE_OPS[moduleType]?.[functionName];
  if (!signature) {
    throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
  }
  const inner = new ethers.Interface([signature]);
  const fn = signature.match(/function\s+(\w+)/)[1];
  let innerData;
  if (
    functionName === 'setHierarchicalVotingModule'
    || functionName === 'setTreasuryModule'
    || functionName === 'setFundsBridge'
    || functionName === 'setModuleBridge'
    || functionName === 'removeExternalDLE'
    || functionName === 'updateExternalDLEBalance'
  ) {
    const addr = args.targetAddress || args.address || args.bridge || args._treasuryModule || args.module;
    innerData = inner.encodeFunctionData(fn, [addr]);
  } else if (functionName === 'addExternalDLE') {
    innerData = inner.encodeFunctionData(fn, [
      args.dleAddress || args.targetAddress,
      String(args.name || ''),
      String(args.symbol || ''),
    ]);
  } else if (functionName === 'updateAllExternalDLEBalances') {
    innerData = inner.encodeFunctionData(fn, []);
  } else {
    throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
  }
  const dleIface = new ethers.Interface(['function _callModuleBridge(bytes32,bytes)']);
  return dleIface.encodeFunctionData('_callModuleBridge', [moduleId, innerData]);
}

export function isModuleBridgeAddressOp(moduleType, functionName) {
  return functionName === 'setHierarchicalVotingModule'
    || functionName === 'setTreasuryModule'
    || functionName === 'setFundsBridge'
    || functionName === 'setModuleBridge'
    || functionName === 'removeExternalDLE'
    || functionName === 'updateExternalDLEBalance';
}

/** Любая ops HV/treasury через module bridge (кроме treasury funds-формы). */
export function isModuleBridgeOp(moduleType, functionName) {
  if (!MODULE_BRIDGE_OPS[moduleType]?.[functionName]) return false;
  if (moduleType === 'treasury' && isTreasuryFundsBridgeOp(moduleType, functionName)) return false;
  return true;
}

export function isTreasuryFundsBridgeOp(moduleType, functionName) {
  return moduleType === 'treasury'
    && (
      functionName === 'transferFunds'
      || functionName === 'addToken'
      || functionName === 'removeToken'
      || functionName === 'setTokenStatus'
      || functionName === 'transferERC721'
      || functionName === 'transferERC1155'
    );
}

/**
 * Encode DLE._callModuleBridge for treasury bridge ops (funds / NFT / addToken).
 * @param {string} functionName
 * @param {string} moduleId bytes32
 * @param {object} args
 */
export function encodeTreasuryBridgeOperation(functionName, moduleId, args) {
  const signature = MODULE_BRIDGE_OPS.treasury?.[functionName];
  if (!signature) {
    throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
  }
  const inner = new ethers.Interface([signature]);
  let innerData;
  if (functionName === 'transferFunds') {
    innerData = inner.encodeFunctionData('transferFunds', [
      args.tokenAddress,
      args.recipient,
      args.amountUnits,
      args.proposalIdBytes32,
    ]);
  } else if (functionName === 'transferERC721') {
    innerData = inner.encodeFunctionData('transferERC721', [
      args.tokenAddress || args.nftContract,
      args.recipient,
      args.tokenId,
      args.proposalIdBytes32,
    ]);
  } else if (functionName === 'transferERC1155') {
    innerData = inner.encodeFunctionData('transferERC1155', [
      args.tokenAddress || args.nftContract,
      args.recipient,
      args.tokenId,
      args.amountUnits,
      args.proposalIdBytes32,
    ]);
  } else if (functionName === 'addToken') {
    innerData = inner.encodeFunctionData('addToken', [
      args.tokenAddress,
      args.symbol,
      Number(args.decimals),
    ]);
  } else if (functionName === 'removeToken') {
    innerData = inner.encodeFunctionData('removeToken', [args.tokenAddress]);
  } else if (functionName === 'setTokenStatus') {
    innerData = inner.encodeFunctionData('setTokenStatus', [
      args.tokenAddress,
      Boolean(args.isActive),
    ]);
  } else {
    throw new Error(t('smartcontracts.moduleBridgeOp.unsupportedOp'));
  }
  const dleIface = new ethers.Interface(['function _callModuleBridge(bytes32,bytes)']);
  return dleIface.encodeFunctionData('_callModuleBridge', [moduleId, innerData]);
}

/**
 * Исполнить мультиконтрактное предложение во всех целевых сетях
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeMultichainProposal(dleAddress, proposalId, userAddress) {
  try {
    const { getProposalMultichainInfo, formatExecutionResult, getExecutionErrors } =
      await import('@/services/multichainExecutionService');
    const hexChain = await window.ethereum.request({ method: 'eth_chainId' });
    const governanceChainId = parseInt(hexChain, 16);
    const info = await getProposalMultichainInfo(dleAddress, proposalId, governanceChainId);
    const chains = (info.targetChains && info.targetChains.length)
      ? info.targetChains
      : [governanceChainId];
    const executionResults = [];
    for (const chainId of chains) {
      const switched = await switchToVotingNetwork(chainId);
      if (!switched) {
        executionResults.push({ chainId, success: false, error: `Не удалось переключить сеть ${chainId}` });
        continue;
      }
      await new Promise((r) => setTimeout(r, 800));
      try {
        const result = await executeProposal(dleAddress, proposalId);
        executionResults.push({
          chainId,
          success: true,
          transactionHash: result.txHash,
        });
      } catch (error) {
        executionResults.push({
          chainId,
          success: false,
          error: error.message,
        });
      }
    }
    const successful = executionResults.filter((r) => r.success).length;
    const result = {
      proposalId,
      targetChains: chains,
      executionResults,
      summary: {
        total: executionResults.length,
        successful,
        failed: executionResults.length - successful,
      },
    };
    return {
      success: true,
      result,
      summary: formatExecutionResult(result),
      errors: getExecutionErrors(result),
      userAddress,
    };
  } catch (error) {
    console.error('Ошибка исполнения мультиконтрактного предложения:', error);
    throw error;
  }
}

/**
 * Исполнить мультиконтрактное предложение в конкретной сети
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {number} targetChainId - ID целевой сети
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeMultichainProposalInChain(dleAddress, proposalId, targetChainId, userAddress) {
  try {
    const { getChainName } = await import('@/services/multichainExecutionService');
    const switched = await switchToVotingNetwork(targetChainId);
    if (!switched) {
      throw new Error(`Не удалось переключить сеть ${targetChainId}`);
    }
    const result = await executeProposal(dleAddress, proposalId);
    return {
      success: true,
      result,
      chainName: getChainName(targetChainId),
      userAddress,
    };
  } catch (error) {
    console.error('Ошибка исполнения мультиконтрактного предложения в сети:', error);
    throw error;
  }
} 