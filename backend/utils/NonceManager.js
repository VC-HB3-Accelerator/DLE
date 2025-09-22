/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const { ethers } = require('ethers');

/**
 * Менеджер nonce для синхронизации транзакций в мультичейн-деплое
 * Обеспечивает правильную последовательность транзакций без конфликтов
 */
class NonceManager {
  constructor() {
    this.nonceCache = new Map(); // Кэш nonce для каждого кошелька
    this.pendingTransactions = new Map(); // Ожидающие транзакции
    this.locks = new Map(); // Блокировки для предотвращения конкурентного доступа
  }

  /**
   * Получить актуальный nonce для кошелька в сети
   * @param {string} rpcUrl - URL RPC провайдера
   * @param {string} walletAddress - Адрес кошелька
   * @param {boolean} usePending - Использовать pending транзакции
   * @returns {Promise<number>} Актуальный nonce
   */
  async getCurrentNonce(rpcUrl, walletAddress, usePending = true) {
    const key = `${walletAddress}-${rpcUrl}`;
    
    try {
      // Создаем провайдер из rpcUrl
      const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
      
      const nonce = await Promise.race([
        provider.getTransactionCount(walletAddress, usePending ? 'pending' : 'latest'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Nonce timeout')), 30000))
      ]);
      
      console.log(`[NonceManager] Получен nonce для ${walletAddress} в сети ${rpcUrl}: ${nonce}`);
      return nonce;
    } catch (error) {
      console.error(`[NonceManager] Ошибка получения nonce для ${walletAddress}:`, error.message);
      
      // Если сеть недоступна, возвращаем 0 как fallback
      if (error.message.includes('network is not available') || error.message.includes('NETWORK_ERROR')) {
        console.warn(`[NonceManager] Сеть недоступна, используем nonce 0 для ${walletAddress}`);
        return 0;
      }
      
      throw error;
    }
  }

  /**
   * Заблокировать nonce для транзакции
   * @param {ethers.Wallet} wallet - Кошелек
   * @param {ethers.Provider} provider - Провайдер сети
   * @returns {Promise<number>} Заблокированный nonce
   */
  async lockNonce(rpcUrl, walletAddress) {
    const key = `${walletAddress}-${rpcUrl}`;
    
    // Ждем освобождения блокировки
    while (this.locks.has(key)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Устанавливаем блокировку
    this.locks.set(key, true);
    
    try {
      const currentNonce = await this.getCurrentNonce(rpcUrl, walletAddress);
      const lockedNonce = currentNonce;
      
      // Обновляем кэш
      this.nonceCache.set(key, lockedNonce + 1);
      
      console.log(`[NonceManager] Заблокирован nonce ${lockedNonce} для ${walletAddress} в сети ${rpcUrl}`);
      return lockedNonce;
    } finally {
      // Освобождаем блокировку
      this.locks.delete(key);
    }
  }

  /**
   * Освободить nonce после успешной транзакции
   * @param {ethers.Wallet} wallet - Кошелек
   * @param {ethers.Provider} provider - Провайдер сети
   * @param {number} nonce - Использованный nonce
   */
  releaseNonce(rpcUrl, walletAddress, nonce) {
    const key = `${walletAddress}-${rpcUrl}`;
    const cachedNonce = this.nonceCache.get(key) || 0;
    
    if (nonce >= cachedNonce) {
      this.nonceCache.set(key, nonce + 1);
    }
    
    console.log(`[NonceManager] Освобожден nonce ${nonce} для ${walletAddress} в сети ${rpcUrl}`);
  }

  /**
   * Синхронизировать nonce между сетями
   * @param {Array} networks - Массив сетей с кошельками
   * @returns {Promise<number>} Синхронизированный nonce
   */
  async synchronizeNonce(networks) {
    console.log(`[NonceManager] Начинаем синхронизацию nonce для ${networks.length} сетей`);
    
    // Получаем nonce для всех сетей
    const nonces = await Promise.all(
      networks.map(async (network, index) => {
        try {
          const nonce = await this.getCurrentNonce(network.rpcUrl, network.wallet.address);
          console.log(`[NonceManager] Сеть ${index + 1}/${networks.length} (${network.chainId}): nonce=${nonce}`);
          return { chainId: network.chainId, nonce, index };
        } catch (error) {
          console.error(`[NonceManager] Ошибка получения nonce для сети ${network.chainId}:`, error.message);
          throw error;
        }
      })
    );

    // Находим максимальный nonce
    const maxNonce = Math.max(...nonces.map(n => n.nonce));
    console.log(`[NonceManager] Максимальный nonce: ${maxNonce}`);

    // Выравниваем nonce во всех сетях
    for (const network of networks) {
      const currentNonce = nonces.find(n => n.chainId === network.chainId)?.nonce || 0;
      
      if (currentNonce < maxNonce) {
        console.log(`[NonceManager] Выравниваем nonce в сети ${network.chainId} с ${currentNonce} до ${maxNonce}`);
        await this.alignNonce(network.wallet, network.provider, currentNonce, maxNonce);
      }
    }

    console.log(`[NonceManager] Синхронизация nonce завершена. Целевой nonce: ${maxNonce}`);
    return maxNonce;
  }

  /**
   * Выровнять nonce до целевого значения
   * @param {ethers.Wallet} wallet - Кошелек
   * @param {ethers.Provider} provider - Провайдер сети
   * @param {number} currentNonce - Текущий nonce
   * @param {number} targetNonce - Целевой nonce
   */
  async alignNonce(wallet, provider, currentNonce, targetNonce) {
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    let nonce = currentNonce;
    
    while (nonce < targetNonce) {
      try {
        // Получаем актуальный nonce перед каждой транзакцией
        const actualNonce = await this.getCurrentNonce(provider._getConnection().url, wallet.address);
        if (actualNonce > nonce) {
          nonce = actualNonce;
          continue;
        }

        const feeOverrides = await this.getFeeOverrides(provider);
        const txReq = {
          to: burnAddress,
          value: 0n,
          nonce: nonce,
          gasLimit: 21000,
          ...feeOverrides
        };

        console.log(`[NonceManager] Отправляем заполняющую транзакцию nonce=${nonce} в сети ${provider._network?.chainId}`);
        const tx = await wallet.sendTransaction(txReq);
        await tx.wait();
        
        console.log(`[NonceManager] Заполняющая транзакция nonce=${nonce} подтверждена в сети ${provider._network?.chainId}`);
        nonce++;
        
        // Небольшая задержка между транзакциями
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`[NonceManager] Ошибка заполняющей транзакции nonce=${nonce}:`, error.message);
        
        if (error.message.includes('nonce too low')) {
          // Обновляем nonce и пробуем снова
          nonce = await this.getCurrentNonce(provider._getConnection().url, wallet.address);
          continue;
        }
        
        throw error;
      }
    }
  }

  /**
   * Получить параметры комиссии для сети
   * @param {ethers.Provider} provider - Провайдер сети
   * @returns {Promise<Object>} Параметры комиссии
   */
  async getFeeOverrides(provider) {
    try {
      const feeData = await provider.getFeeData();
      
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        return {
          maxFeePerGas: feeData.maxFeePerGas,
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
        };
      } else {
        return {
          gasPrice: feeData.gasPrice
        };
      }
    } catch (error) {
      console.warn(`[NonceManager] Ошибка получения fee data:`, error.message);
      return {};
    }
  }

  /**
   * Безопасная отправка транзакции с правильным nonce
   * @param {ethers.Wallet} wallet - Кошелек
   * @param {ethers.Provider} provider - Провайдер сети
   * @param {Object} txData - Данные транзакции
   * @param {number} maxRetries - Максимальное количество попыток
   * @returns {Promise<ethers.TransactionResponse>} Результат транзакции
   */
  async sendTransactionSafely(wallet, provider, txData, maxRetries = 1) {
    const rpcUrl = provider._getConnection().url;
    const walletAddress = wallet.address;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Получаем актуальный nonce
        const nonce = await this.lockNonce(rpcUrl, walletAddress);
        
        const tx = await wallet.sendTransaction({
          ...txData,
          nonce: nonce
        });
        
        console.log(`[NonceManager] Транзакция отправлена с nonce=${nonce} в сети ${provider._network?.chainId}`);
        
        // Ждем подтверждения
        await tx.wait();
        
        // Освобождаем nonce
        this.releaseNonce(rpcUrl, walletAddress, nonce);
        
        return tx;
        
      } catch (error) {
        console.error(`[NonceManager] Попытка ${attempt + 1}/${maxRetries} неудачна:`, error.message);
        
        if (error.message.includes('nonce too low') && attempt < maxRetries - 1) {
          // Обновляем nonce и пробуем снова
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }
  }

  /**
   * Очистить кэш nonce
   */
  clearCache() {
    this.nonceCache.clear();
    this.pendingTransactions.clear();
    this.locks.clear();
    console.log(`[NonceManager] Кэш nonce очищен`);
  }
}

module.exports = NonceManager;
