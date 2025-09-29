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

/* eslint-disable no-console */

// КРИТИЧЕСКИЙ ЛОГ - СКРИПТ ЗАПУЩЕН!
console.log('[MULTI_DBG] 🚀 СКРИПТ DEPLOY-MULTICHAIN.JS ЗАПУЩЕН!');

console.log('[MULTI_DBG] 📦 Импортируем hardhat...');
const hre = require('hardhat');
console.log('[MULTI_DBG] ✅ hardhat импортирован');

console.log('[MULTI_DBG] 📦 Импортируем path...');
const path = require('path');
console.log('[MULTI_DBG] ✅ path импортирован');

console.log('[MULTI_DBG] 📦 Импортируем fs...');
const fs = require('fs');
console.log('[MULTI_DBG] ✅ fs импортирован');

console.log('[MULTI_DBG] 📦 Импортируем rpcProviderService...');
const { getRpcUrlByChainId } = require('../../services/rpcProviderService');
console.log('[MULTI_DBG] ✅ rpcProviderService импортирован');

console.log('[MULTI_DBG] 📦 Импортируем logger...');
const logger = require('../../utils/logger');
console.log('[MULTI_DBG] ✅ logger импортирован');

console.log('[MULTI_DBG] 📦 Импортируем deploymentUtils...');
const { getFeeOverrides, createProviderAndWallet, alignNonce, getNetworkInfo, createMultipleRPCConnections, sendTransactionWithRetry, createRPCConnection } = require('../../utils/deploymentUtils');
console.log('[MULTI_DBG] ✅ deploymentUtils импортирован');

console.log('[MULTI_DBG] 📦 Импортируем nonceManager...');
const { nonceManager } = require('../../utils/nonceManager');
console.log('[MULTI_DBG] ✅ nonceManager импортирован');

console.log('[MULTI_DBG] 🎯 ВСЕ ИМПОРТЫ УСПЕШНЫ!');

console.log('[MULTI_DBG] 🔍 ПРОВЕРЯЕМ ФУНКЦИИ...');
console.log('[MULTI_DBG] deployInNetwork:', typeof deployInNetwork);
console.log('[MULTI_DBG] main:', typeof main);

async function deployInNetwork(rpcUrl, pk, initCodeHash, targetDLENonce, dleInit, params) {
  const { ethers } = hre;
  
  // Используем новый менеджер RPC с retry логикой
  const { provider, wallet, network } = await createRPCConnection(rpcUrl, pk, {
    maxRetries: 3,
    timeout: 30000
  });
  
  const net = network;

  // DEBUG: базовая информация по сети
  try {
    const calcInitHash = ethers.keccak256(dleInit);
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} rpc=${rpcUrl}`);
    logger.info(`[MULTI_DBG] wallet=${wallet.address} targetDLENonce=${targetDLENonce}`);
    logger.info(`[MULTI_DBG] initCodeHash(provided)=${initCodeHash}`);
    logger.info(`[MULTI_DBG] initCodeHash(calculated)=${calcInitHash}`);
    logger.info(`[MULTI_DBG] dleInit.lenBytes=${ethers.getBytes(dleInit).length} head16=${dleInit.slice(0, 34)}...`);
  } catch (e) {
    logger.error('[MULTI_DBG] precheck error', e?.message || e);
  }

  // 1) Используем NonceManager для правильного управления nonce
  const chainId = Number(net.chainId);
  let current = await nonceManager.getNonce(wallet.address, rpcUrl, chainId);
  logger.info(`[MULTI_DBG] chainId=${chainId} current nonce=${current} target=${targetDLENonce}`);
  
  if (current > targetDLENonce) {
    logger.warn(`[MULTI_DBG] chainId=${Number(net.chainId)} current nonce ${current} > targetDLENonce ${targetDLENonce} - waiting for sync`);
    
    // Ждем синхронизации nonce (максимум 60 секунд с прогрессивной задержкой)
    let waitTime = 0;
    let checkInterval = 1000; // Начинаем с 1 секунды
    
    while (current > targetDLENonce && waitTime < 60000) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      current = await nonceManager.getNonce(wallet.address, rpcUrl, chainId);
      waitTime += checkInterval;
      
      // Прогрессивно увеличиваем интервал проверки
      if (waitTime > 10000) checkInterval = 2000;
      if (waitTime > 30000) checkInterval = 5000;
      
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} waiting for nonce sync: ${current} > ${targetDLENonce} (${waitTime}ms, next check in ${checkInterval}ms)`);
    }
    
    if (current > targetDLENonce) {
      const errorMsg = `Nonce sync timeout: current ${current} > targetDLENonce ${targetDLENonce} on chainId=${Number(net.chainId)}. This may indicate network issues or the wallet was used for other transactions.`;
      logger.error(`[MULTI_DBG] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce sync completed: ${current} <= ${targetDLENonce}`);
  }
  
  if (current < targetDLENonce) {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} starting nonce alignment: ${current} -> ${targetDLENonce} (${targetDLENonce - current} transactions needed)`);
  } else {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce already aligned: ${current} = ${targetDLENonce}`);
  }
  
  if (current < targetDLENonce) {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} aligning nonce from ${current} to ${targetDLENonce} (${targetDLENonce - current} transactions needed)`);
    
    // Используем burn address для более надежных транзакций
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    
    while (current < targetDLENonce) {
      const overrides = await getFeeOverrides(provider);
      let gasLimit = 21000; // минимальный gas для обычной транзакции
      let sent = false;
      let lastErr = null;
      
      for (let attempt = 0; attempt < 5 && !sent; attempt++) {
        try {
          const txReq = {
            to: burnAddress, // отправляем на burn address вместо своего адреса
            value: 0n,
            nonce: current,
            gasLimit,
            ...overrides
          };
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} sending filler tx nonce=${current} attempt=${attempt + 1}/5`);
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} tx details: to=${burnAddress}, value=0, gasLimit=${gasLimit}`);
          const { tx: txFill, receipt } = await sendTransactionWithRetry(wallet, txReq, { maxRetries: 3 });
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx sent, hash=${txFill.hash}, waiting for confirmation...`);
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} confirmed, hash=${txFill.hash}`);
          sent = true;
        } catch (e) {
          lastErr = e;
          const errorMsg = e?.message || e;
          logger.warn(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} attempt=${attempt + 1} failed: ${errorMsg}`);
          
          // Обработка специфических ошибок
          if (String(errorMsg).toLowerCase().includes('intrinsic gas too low') && attempt < 4) {
            gasLimit = Math.min(gasLimit * 2, 100000); // увеличиваем gas limit с ограничением
            logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} increased gas limit to ${gasLimit}`);
            continue;
          }
          
          if (String(errorMsg).toLowerCase().includes('nonce too low') && attempt < 4) {
            // Сбрасываем кэш nonce и получаем актуальный
            nonceManager.resetNonce(wallet.address, chainId);
            const newNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 15000, maxRetries: 5 });
            logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce changed from ${current} to ${newNonce}`);
            current = newNonce;
            
            // Если новый nonce больше целевого, обновляем targetDLENonce
            if (current > targetDLENonce) {
              logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} current nonce ${current} > target nonce ${targetDLENonce}, updating target`);
              targetDLENonce = current;
              logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} updated targetDLENonce to: ${targetDLENonce}`);
            }
            
            continue;
          }
          
          if (String(errorMsg).toLowerCase().includes('insufficient funds') && attempt < 4) {
            logger.error(`[MULTI_DBG] chainId=${Number(net.chainId)} insufficient funds for nonce alignment`);
            throw new Error(`Insufficient funds for nonce alignment on chainId=${Number(net.chainId)}. Please add more ETH to the wallet.`);
          }
          
          if (String(errorMsg).toLowerCase().includes('network') && attempt < 4) {
            logger.warn(`[MULTI_DBG] chainId=${Number(net.chainId)} network error, retrying in ${(attempt + 1) * 2} seconds...`);
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 2000));
            continue;
          }
          
          // Если это последняя попытка, выбрасываем ошибку
          if (attempt === 4) {
            throw new Error(`Failed to send filler transaction after 5 attempts: ${errorMsg}`);
          }
        }
      }
      
      if (!sent) {
        logger.error(`[MULTI_DBG] chainId=${Number(net.chainId)} failed to send filler tx for nonce=${current}`);
        throw lastErr || new Error('filler tx failed');
      }
      
      current++;
    }
    
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce alignment completed, current nonce=${current}`);
    
    // Зарезервируем nonce в NonceManager
    nonceManager.reserveNonce(wallet.address, chainId, targetDLENonce);
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} ready for DLE deployment with nonce=${current}`);
  } else {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce already aligned at ${current}`);
  }

  // 2) Проверяем баланс перед деплоем
  const balance = await provider.getBalance(wallet.address, 'latest');
  const balanceEth = ethers.formatEther(balance);
  logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} wallet balance: ${balanceEth} ETH`);
  
  if (balance < ethers.parseEther('0.01')) {
    throw new Error(`Insufficient balance for deployment on chainId=${Number(net.chainId)}. Current: ${balanceEth} ETH, required: 0.01 ETH minimum`);
  }
  
  // 3) Деплой DLE с актуальным nonce
  logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} deploying DLE with current nonce`);
  
  const feeOverrides = await getFeeOverrides(provider);
  let gasLimit;
  
  try {
    // Оцениваем газ для деплоя DLE
    const est = await wallet.estimateGas({ data: dleInit, ...feeOverrides }).catch(() => null);
    
    // Рассчитываем доступный gasLimit из баланса
    const balance = await provider.getBalance(wallet.address, 'latest');
    const effPrice = feeOverrides.maxFeePerGas || feeOverrides.gasPrice || 0n;
    const reserve = hre.ethers.parseEther('0.005');
    const maxByBalance = effPrice > 0n && balance > reserve ? (balance - reserve) / effPrice : 3_000_000n;
    const fallbackGas = maxByBalance > 5_000_000n ? 5_000_000n : (maxByBalance < 2_500_000n ? 2_500_000n : maxByBalance);
    gasLimit = est ? (est + est / 5n) : fallbackGas;
    
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
  } catch (_) {
    gasLimit = 3_000_000n;
  }

  // Вычисляем предсказанный адрес DLE с целевым nonce (детерминированный деплой)
  let predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: targetDLENonce
  });
  logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} predicted DLE address=${predictedAddress} (nonce=${targetDLENonce})`);

  // Проверяем, не развернут ли уже контракт
  const existingCode = await provider.getCode(predictedAddress);
  if (existingCode && existingCode !== '0x') {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE already exists at predictedAddress, skip deploy`);
    
    // Проверяем и инициализируем логотип для существующего контракта
    if (params.logoURI && params.logoURI !== '') {
      try {
        logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} checking logoURI for existing contract`);
        const DLE = await hre.ethers.getContractFactory('DLE');
        const dleContract = DLE.attach(predictedAddress);
        
        const currentLogo = await dleContract.logoURI();
        if (currentLogo === '' || currentLogo === '0x') {
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing logoURI for existing contract: ${params.logoURI}`);
          const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
          await logoTx.wait();
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialized for existing contract`);
        } else {
          logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI already set: ${currentLogo}`);
        }
      } catch (error) {
        logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialization failed for existing contract: ${error.message}`);
      }
    }
    
    return { address: predictedAddress, chainId: Number(net.chainId) };
  }

  // Деплоим DLE с retry логикой для обработки race conditions
  let tx;
  let deployAttempts = 0;
  const maxDeployAttempts = 5;
  
  while (deployAttempts < maxDeployAttempts) {
    try {
      deployAttempts++;
      
      // Получаем актуальный nonce прямо перед отправкой транзакции
      const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 15000, maxRetries: 5 });
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} deploy attempt ${deployAttempts}/${maxDeployAttempts} with current nonce=${currentNonce} (target was ${targetDLENonce})`);
      
      const txData = {
        data: dleInit,
        nonce: currentNonce,
        gasLimit,
        ...feeOverrides
      };
      
      const result = await sendTransactionWithRetry(wallet, txData, { maxRetries: 3 });
      tx = result.tx;
      
      // Отмечаем транзакцию как pending в NonceManager
      nonceManager.markTransactionPending(wallet.address, chainId, currentNonce, tx.hash);
      
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} deploy successful on attempt ${deployAttempts}`);
      break; // Успешно отправили, выходим из цикла
      
    } catch (e) {
      const errorMsg = e?.message || e;
      logger.warn(`[MULTI_DBG] chainId=${Number(net.chainId)} deploy attempt ${deployAttempts} failed: ${errorMsg}`);
      
      // Проверяем, является ли это ошибкой nonce
      if (String(errorMsg).toLowerCase().includes('nonce too low') && deployAttempts < maxDeployAttempts) {
        logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce race condition detected, retrying...`);
        
        // Получаем актуальный nonce из сети
        const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 15000, maxRetries: 5 });
        logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} current nonce: ${currentNonce}, target was: ${targetDLENonce}`);
        
        // Обновляем targetDLENonce на актуальный nonce
        targetDLENonce = currentNonce;
        logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} updated targetDLENonce to: ${targetDLENonce}`);
        
        // Короткая задержка перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Если это не ошибка nonce или исчерпаны попытки, выбрасываем ошибку
      if (deployAttempts >= maxDeployAttempts) {
        throw new Error(`Deployment failed after ${maxDeployAttempts} attempts: ${errorMsg}`);
      }
      
      // Для других ошибок делаем короткую задержку и пробуем снова
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const rc = await tx.wait();
  
  // Отмечаем транзакцию как подтвержденную в NonceManager
  nonceManager.markTransactionConfirmed(wallet.address, chainId, tx.hash);
  const deployedAddress = rc.contractAddress || predictedAddress;
  
  // Проверяем, что адрес соответствует предсказанному
  if (deployedAddress !== predictedAddress) {
    logger.error(`[MULTI_DBG] chainId=${Number(net.chainId)} ADDRESS MISMATCH! predicted=${predictedAddress} actual=${deployedAddress}`);
    throw new Error(`Address mismatch: predicted ${predictedAddress} != actual ${deployedAddress}`);
  }
  
  logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE deployed at=${deployedAddress} ✅`);
  
  // Инициализация логотипа если он указан
  if (params.logoURI && params.logoURI !== '') {
    try {
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing logoURI: ${params.logoURI}`);
      const DLE = await hre.ethers.getContractFactory('DLE');
      const dleContract = DLE.attach(deployedAddress);
      
      const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
      await logoTx.wait();
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialized successfully`);
    } catch (error) {
      logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialization failed: ${error.message}`);
      // Не прерываем деплой из-за ошибки логотипа
    }
  } else {
    logger.info(`[MULTI_DBG] chainId=${Number(net.chainId)} no logoURI specified, skipping initialization`);
  }
  
  return { address: deployedAddress, chainId: Number(net.chainId) };
}


async function main() {
  console.log('[MULTI_DBG] 🚀 ВХОДИМ В ФУНКЦИЮ MAIN!');
  const { ethers } = hre;
  console.log('[MULTI_DBG] ✅ ethers получен');
  
  logger.info('[MULTI_DBG] 🚀 НАЧИНАЕМ ДЕПЛОЙ DLE КОНТРАКТА');
  console.log('[MULTI_DBG] ✅ logger.info выполнен');
  
  // Автоматически генерируем ABI и flattened контракт перед деплоем
  logger.info('🔨 Генерация ABI файла...');
  try {
    const { generateABIFile } = require('../generate-abi');
    generateABIFile();
    logger.info('✅ ABI файл обновлен перед деплоем');
  } catch (abiError) {
    logger.warn('⚠️ Ошибка генерации ABI:', abiError.message);
  }
  
  logger.info('🔨 Генерация flattened контракта...');
  try {
    const { generateFlattened } = require('../generate-flattened');
    await generateFlattened();
    logger.info('✅ Flattened контракт обновлен перед деплоем');
  } catch (flattenError) {
    logger.warn('⚠️ Ошибка генерации flattened контракта:', flattenError.message);
  }
  
  // Загружаем параметры из базы данных или файла
  console.log('[MULTI_DBG] 🔍 НАЧИНАЕМ ЗАГРУЗКУ ПАРАМЕТРОВ...');
  let params;
  
  try {
    // Пытаемся загрузить из базы данных
    const DeployParamsService = require('../../services/deployParamsService');
    const deployParamsService = new DeployParamsService();
    
    // Проверяем, передан ли конкретный deploymentId
    const deploymentId = process.env.DEPLOYMENT_ID;
    if (deploymentId) {
      logger.info(`🔍 Ищем параметры для deploymentId: ${deploymentId}`);
      params = await deployParamsService.getDeployParams(deploymentId);
      if (params) {
        logger.info('✅ Параметры загружены из базы данных по deploymentId');
      } else {
        throw new Error(`Параметры деплоя не найдены для deploymentId: ${deploymentId}`);
      }
    } else {
      // Получаем последние параметры деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        params = latestParams[0];
        logger.info('✅ Параметры загружены из базы данных (последние)');
      } else {
        throw new Error('Параметры деплоя не найдены в базе данных');
      }
    }
    
    await deployParamsService.close();
  } catch (dbError) {
    logger.error('❌ Критическая ошибка: не удалось загрузить параметры из БД:', dbError.message);
    throw new Error(`Деплой невозможен без параметров из БД: ${dbError.message}`);
  }
  logger.info('[MULTI_DBG] Загружены параметры:', {
    name: params.name,
    symbol: params.symbol,
    supportedChainIds: params.supportedChainIds,
    rpcUrls: params.rpcUrls || params.rpc_urls,
    etherscanApiKey: params.etherscanApiKey || params.etherscan_api_key
  });

  const pk = params.private_key || process.env.PRIVATE_KEY;
  const networks = params.rpcUrls || params.rpc_urls || [];
  
  // Устанавливаем API ключи Etherscan для верификации
  const ApiKeyManager = require('../../utils/apiKeyManager');
  const etherscanKey = ApiKeyManager.getAndSetEtherscanApiKey(params);
  
  if (!etherscanKey) {
    logger.warn('[MULTI_DBG] ⚠️ Etherscan API ключ не найден - верификация будет пропущена');
    logger.warn(`[MULTI_DBG] Доступные поля: ${Object.keys(params).join(', ')}`);
  }
  
  if (!pk) throw new Error('Env: PRIVATE_KEY');
  if (networks.length === 0) throw new Error('RPC URLs not found in params');

  // Prepare init code once
  const DLE = await hre.ethers.getContractFactory('contracts/DLE.sol:DLE');
  
  // Используем централизованный генератор параметров конструктора
  const { generateDeploymentArgs } = require('../../utils/constructorArgsGenerator');
  const { dleConfig, initializer } = generateDeploymentArgs(params);
  // Проверяем наличие поддерживаемых сетей
  const supportedChainIds = params.supportedChainIds || [];
  if (supportedChainIds.length === 0) {
    throw new Error('Не указаны поддерживаемые сети (supportedChainIds)');
  }
  
  // Создаем initCode для каждой сети отдельно
  const initCodes = {};
  for (const chainId of supportedChainIds) {
    const deployTx = await DLE.getDeployTransaction(dleConfig, initializer);
    initCodes[chainId] = deployTx.data;
  }
  
  // Получаем initCodeHash из первого initCode (все должны быть одинаковые по структуре)
  const firstChainId = supportedChainIds[0];
  const firstInitCode = initCodes[firstChainId];
  if (!firstInitCode) {
    throw new Error(`InitCode не создан для первой сети: ${firstChainId}`);
  }
  const initCodeHash = ethers.keccak256(firstInitCode);
  
  // DEBUG: глобальные значения
  try {
    logger.info(`[MULTI_DBG] GLOBAL initCodeHash(calculated)=${initCodeHash}`);
    logger.info(`[MULTI_DBG] GLOBAL firstInitCode.lenBytes=${ethers.getBytes(firstInitCode).length} head16=${firstInitCode.slice(0, 34)}...`);
  } catch (e) {
    logger.info('[MULTI_DBG] GLOBAL precheck error', e?.message || e);
  }

  // Подготовим провайдеры и вычислим общий nonce для DLE с retry логикой
  logger.info(`[MULTI_DBG] Создаем RPC соединения для ${networks.length} сетей...`);
  const connections = await createMultipleRPCConnections(networks, pk, {
    maxRetries: 3,
    timeout: 30000
  });
  
  if (connections.length === 0) {
    throw new Error('Не удалось установить ни одного RPC соединения');
  }
  
  logger.info(`[MULTI_DBG] ✅ Успешно подключились к ${connections.length}/${networks.length} сетям`);
  
  // Очищаем старые pending транзакции для всех сетей
  for (const connection of connections) {
    const chainId = Number(connection.network.chainId);
    nonceManager.clearOldPendingTransactions(connection.wallet.address, chainId);
  }
  
  const nonces = [];
  for (const connection of connections) {
    const n = await nonceManager.getNonce(connection.wallet.address, connection.rpcUrl, Number(connection.network.chainId));
    nonces.push(n);
  }
  const targetDLENonce = Math.max(...nonces);
  logger.info(`[MULTI_DBG] nonces=${JSON.stringify(nonces)} targetDLENonce=${targetDLENonce}`);
  logger.info(`[MULTI_DBG] Starting deployment to ${networks.length} networks:`, networks);

  // ПАРАЛЛЕЛЬНЫЙ деплой во всех успешных сетях одновременно
  console.log(`[MULTI_DBG] 🚀 ДОШЛИ ДО ПАРАЛЛЕЛЬНОГО ДЕПЛОЯ!`);
  logger.info(`[MULTI_DBG] Starting PARALLEL deployment to ${connections.length} successful networks`);
  logger.info(`[MULTI_DBG] 🚀 ЗАПУСКАЕМ ЦИКЛ ДЕПЛОЯ!`);
  
  const deploymentPromises = connections.map(async (connection, i) => {
    const rpcUrl = connection.rpcUrl;
    const chainId = Number(connection.network.chainId);
    
    logger.info(`[MULTI_DBG] 🚀 Starting deployment to network ${i + 1}/${connections.length}: ${rpcUrl} (chainId: ${chainId})`);
    
    try {
      // Получаем правильный initCode для этой сети
      const networkInitCode = initCodes[chainId];
      if (!networkInitCode) {
        throw new Error(`InitCode не найден для chainId: ${chainId}`);
      }
      
      const r = await deployInNetwork(rpcUrl, pk, initCodeHash, targetDLENonce, networkInitCode, params);
      logger.info(`[MULTI_DBG] ✅ Network ${i + 1} (chainId: ${chainId}) deployment SUCCESS: ${r.address}`);
      return { rpcUrl, chainId, address: r.address, chainId: r.chainId };
    } catch (error) {
      logger.error(`[MULTI_DBG] ❌ Network ${i + 1} deployment FAILED:`, error.message);
      return { rpcUrl, chainId, error: error.message };
    }
  });
  
  // Ждем завершения всех деплоев
  const results = await Promise.all(deploymentPromises);
  logger.info(`[MULTI_DBG] All ${networks.length} deployments completed`);
  
  // Логируем результаты для каждой сети
  results.forEach((result, index) => {
    if (result.address) {
      logger.info(`[MULTI_DBG] ✅ Network ${index + 1} (chainId: ${result.chainId}) SUCCESS: ${result.address}`);
    } else {
      logger.info(`[MULTI_DBG] ❌ Network ${index + 1} (chainId: ${result.chainId}) FAILED: ${result.error}`);
    }
  });
  
  // Проверяем, что все адреса одинаковые (критично для детерминированного деплоя)
  const addresses = results.map(r => r.address).filter(addr => addr);
  const uniqueAddresses = [...new Set(addresses)];
  
  logger.info('[MULTI_DBG] All addresses:', addresses);
  logger.info('[MULTI_DBG] Unique addresses:', uniqueAddresses);
  logger.info('[MULTI_DBG] Results count:', results.length);
  logger.info('[MULTI_DBG] Networks count:', networks.length);
  
  if (uniqueAddresses.length > 1) {
    logger.error('[MULTI_DBG] ERROR: DLE addresses are different across networks!');
    logger.error('[MULTI_DBG] addresses:', uniqueAddresses);
    throw new Error('Nonce alignment failed - addresses are different');
  }
  
  if (uniqueAddresses.length === 0) {
    logger.error('[MULTI_DBG] ERROR: No successful deployments!');
    throw new Error('No successful deployments');
  }
  
  logger.info('[MULTI_DBG] SUCCESS: All DLE addresses are identical:', uniqueAddresses[0]);
  
  // ВЫВОДИМ РЕЗУЛЬТАТ СРАЗУ ПОСЛЕ ДЕПЛОЯ (ПЕРЕД ВЕРИФИКАЦИЕЙ)!
  console.log('[MULTI_DBG] 🎯 ДОШЛИ ДО ВЫВОДА РЕЗУЛЬТАТА!');
  const finalResults = results.map((result, index) => ({
    ...result,
    verification: 'pending'
  }));
  
  console.log('[MULTI_DBG] 📊 finalResults:', JSON.stringify(finalResults, null, 2));
  console.log('[MULTI_DBG] 🎯 ВЫВОДИМ MULTICHAIN_DEPLOY_RESULT!');
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify(finalResults));
  console.log('[MULTI_DBG] ✅ MULTICHAIN_DEPLOY_RESULT ВЫВЕДЕН!');
  logger.info('[MULTI_DBG] DLE deployment completed successfully!');
  
  // Верификация контрактов отключена
  logger.info('[MULTI_DBG] Contract verification disabled - skipping verification step');
  
  // Отмечаем все результаты как без верификации
  const finalResultsWithVerification = results.map((result) => ({
    ...result,
    verification: 'skipped'
  }));
  
  logger.info('[MULTI_DBG] Verification skipped - deployment completed successfully');
}

console.log('[MULTI_DBG] 🚀 ВЫЗЫВАЕМ MAIN()...');
main().catch((e) => { 
  console.log('[MULTI_DBG] ❌ ОШИБКА В MAIN:', e);
  logger.error('[MULTI_DBG] ❌ Deployment failed:', e);
  
  // Даже при ошибке выводим результат для анализа
  const errorResult = {
    error: e.message,
    success: false,
    timestamp: new Date().toISOString(),
    stack: e.stack
  };
  
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify([errorResult]));
  process.exit(1); 
});


