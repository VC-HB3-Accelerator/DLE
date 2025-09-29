/**
 * Утилиты для переключения сетей блокчейна
 * 
 * Author: HB3 Accelerator
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import { getNetworkConfig, getHexChainId, isNetworkSupported } from './networkConfig.js';

/**
 * Переключить сеть в MetaMask
 * @param {number} targetChainId - ID целевой сети
 * @returns {Promise<Object>} - Результат переключения
 */
export async function switchNetwork(targetChainId) {
  try {
    console.log(`🔄 [Network Switch] Переключаемся на сеть ${targetChainId}...`);
    
    // Проверяем, поддерживается ли сеть
    if (!isNetworkSupported(targetChainId)) {
      throw new Error(`Сеть ${targetChainId} не поддерживается`);
    }
    
    // Проверяем наличие MetaMask
    if (!window.ethereum) {
      throw new Error('MetaMask не найден. Пожалуйста, установите MetaMask.');
    }
    
    // Получаем конфигурацию сети
    const networkConfig = getNetworkConfig(targetChainId);
    if (!networkConfig) {
      throw new Error(`Конфигурация для сети ${targetChainId} не найдена`);
    }
    
    // Проверяем текущую сеть
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log(`🔄 [Network Switch] Текущая сеть: ${currentChainId}, Целевая: ${getHexChainId(targetChainId)}`);
    
    // Если уже в нужной сети, возвращаем успех
    if (currentChainId === getHexChainId(targetChainId)) {
      console.log(`✅ [Network Switch] Уже в сети ${targetChainId}`);
      return {
        success: true,
        message: `Уже в сети ${networkConfig.chainName}`,
        chainId: targetChainId,
        chainName: networkConfig.chainName
      };
    }
    
    // Пытаемся переключиться на существующую сеть
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: getHexChainId(targetChainId) }],
      });
      
      console.log(`✅ [Network Switch] Успешно переключились на ${networkConfig.chainName}`);
      return {
        success: true,
        message: `Переключились на ${networkConfig.chainName}`,
        chainId: targetChainId,
        chainName: networkConfig.chainName
      };
      
    } catch (switchError) {
      // Если сеть не добавлена в MetaMask, добавляем её
      if (switchError.code === 4902) {
        console.log(`➕ [Network Switch] Добавляем сеть ${networkConfig.chainName} в MetaMask...`);
        
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: getHexChainId(targetChainId),
              chainName: networkConfig.chainName,
              nativeCurrency: networkConfig.nativeCurrency,
              rpcUrls: networkConfig.rpcUrls,
              blockExplorerUrls: networkConfig.blockExplorerUrls,
            }],
          });
          
          console.log(`✅ [Network Switch] Сеть ${networkConfig.chainName} добавлена и активирована`);
          return {
            success: true,
            message: `Сеть ${networkConfig.chainName} добавлена и активирована`,
            chainId: targetChainId,
            chainName: networkConfig.chainName
          };
          
        } catch (addError) {
          console.error(`❌ [Network Switch] Ошибка добавления сети:`, addError);
          throw new Error(`Не удалось добавить сеть ${networkConfig.chainName}: ${addError.message}`);
        }
      } else {
        // Другие ошибки переключения
        console.error(`❌ [Network Switch] Ошибка переключения сети:`, switchError);
        throw new Error(`Не удалось переключиться на ${networkConfig.chainName}: ${switchError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ [Network Switch] Ошибка:`, error);
    return {
      success: false,
      error: error.message,
      chainId: targetChainId
    };
  }
}

/**
 * Проверить текущую сеть
 * @returns {Promise<Object>} - Информация о текущей сети
 */
export async function getCurrentNetwork() {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask не найден');
    }
    
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const numericChainId = parseInt(chainId, 16);
    const networkConfig = getNetworkConfig(numericChainId);
    
    return {
      success: true,
      chainId: numericChainId,
      hexChainId: chainId,
      chainName: networkConfig?.chainName || 'Неизвестная сеть',
      isSupported: isNetworkSupported(numericChainId)
    };
    
  } catch (error) {
    console.error('❌ [Network Check] Ошибка:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Получить список поддерживаемых сетей
 * @returns {Array} - Список поддерживаемых сетей
 */
export function getSupportedNetworks() {
  return Object.entries(SUPPORTED_NETWORKS).map(([chainId, config]) => ({
    chainId: parseInt(chainId),
    hexChainId: getHexChainId(parseInt(chainId)),
    chainName: config.chainName,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: config.rpcUrls,
    blockExplorerUrls: config.blockExplorerUrls
  }));
}
