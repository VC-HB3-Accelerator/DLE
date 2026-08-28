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
const { getFeeOverrides, createProviderAndWallet, getNetworkInfo, createMultipleRPCConnections, createRPCConnection } = require('../../utils/deploymentUtils');
const RPCConnectionManager = require('../../utils/rpcConnectionManager');
console.log('[MULTI_DBG] ✅ deploymentUtils импортирован');

console.log('[MULTI_DBG] 📦 Импортируем nonceManager...');
const { nonceManager, MAX_NONCE_FILLERS } = require('../../utils/nonceManager');
console.log('[MULTI_DBG] ✅ nonceManager импортирован');

// ContractVerificationService удален - используем Hardhat verify

console.log('[MULTI_DBG] 🎯 ВСЕ ИМПОРТЫ УСПЕШНЫ!');

console.log('[MULTI_DBG] 🔍 ПРОВЕРЯЕМ ФУНКЦИИ...');
console.log('[MULTI_DBG] deployInNetwork:', typeof deployInNetwork);
console.log('[MULTI_DBG] main:', typeof main);

const { verifyWithStandardJson } = require('../../utils/etherscanStandardJsonVerify');

async function verifyDLEAfterDeploy(chainId, contractAddress, creationTxData, apiKey, rpcUrl) {
  try {
    logger.info(`🔍 Верификация DLE ${contractAddress} chainId=${chainId} (standard-JSON artifact, без hardhat verify)`);
    return await verifyWithStandardJson({
      chainId: Number(chainId),
      contractAddress,
      fullyQualifiedName: 'contracts/DLE.sol:DLE',
      apiKey,
      creationTxData,
      rpcUrl,
    });
  } catch (error) {
    logger.error(`❌ Ошибка при верификации DLE: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function deployInNetwork(chainId, pk, initCodeHash, targetDLENonce, dleInit, params, dleConfig, initializer, etherscanKey) {
  try {
    const { ethers } = hre;
    
    // Получаем RPC URL для данной сети
    const rpcService = require('../../services/rpcProviderService');
    const rpcUrl = await rpcService.getRpcUrlByChainId(chainId);
    if (!rpcUrl) {
      throw new Error(`RPC URL не найден для chainId ${chainId}`);
    }
    
    // Используем новый менеджер RPC с retry логикой
    const { provider, wallet, network } = await createRPCConnection(chainId, pk, {
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

  // 1) Как на VDS: align внутри сети. target = max(nonce) со старта; отстающие догоняют filler.
  let current = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 30000, maxRetries: 3 });
  logger.info(`[MULTI_DBG] chainId=${chainId} current nonce=${current} (target was ${targetDLENonce})`);

  if (current > targetDLENonce) {
    throw new Error(
      `Nonce ${current} > target CREATE nonce ${targetDLENonce} on chainId=${chainId}. Abort, чтобы адреса не разъехались.`
    );
  }

  if (current < targetDLENonce) {
    logger.info(`[MULTI_DBG] chainId=${chainId} aligning nonce from ${current} to ${targetDLENonce} (${targetDLENonce - current} tx)`);
    try {
      current = await nonceManager.alignNonceToTarget(
        wallet.address,
        rpcUrl,
        chainId,
        targetDLENonce,
        wallet,
        { gasLimit: 21000, maxFillers: MAX_NONCE_FILLERS }
      );
      logger.info(`[MULTI_DBG] chainId=${chainId} nonce alignment completed, current nonce=${current}`);
      nonceManager.reserveNonce(wallet.address, chainId, targetDLENonce);
    } catch (error) {
      logger.error(`[MULTI_DBG] chainId=${chainId} nonce alignment failed: ${error.message}`);
      throw error;
    }
  } else {
    logger.info(`[MULTI_DBG] chainId=${chainId} nonce already aligned: ${current} = ${targetDLENonce}`);
  }

  // 2) Проверяем баланс перед деплоем
  const balance = await provider.getBalance(wallet.address, 'latest');
  const balanceEth = ethers.formatEther(balance);
  logger.info(`[MULTI_DBG] chainId=${chainId} wallet balance: ${balanceEth} ETH`);
  
  if (balance < ethers.parseEther('0.01')) {
    throw new Error(`Insufficient balance for deployment on chainId=${chainId}. Current: ${balanceEth} ETH, required: 0.01 ETH minimum`);
  }
  
  // 3) Деплой DLE с актуальным nonce
  logger.info(`[MULTI_DBG] chainId=${chainId} deploying DLE with current nonce`);
  
  // Mainnet: пол 20 gwei съедает весь баланс (~0.019 ETH) на CREATE 24KB. Берём 1 gwei.
  const feeOverrides = Number(chainId) === 1
    ? await getFeeOverrides(provider, { minFeeGwei: 1n, minPriorityGwei: 1n })
    : await getFeeOverrides(provider);
  let gasLimit;
  
  try {
    // Оцениваем газ для деплоя DLE
    const est = await wallet.estimateGas({ data: dleInit, ...feeOverrides }).catch(() => null);
    if (!est && process.env.TARGET_DLE_NONCE) {
      throw new Error(`estimateGas failed on chainId=${chainId}; abort CREATE to avoid OOG at required nonce`);
    }
    
    // Рассчитываем доступный gasLimit из баланса
    const balance = await provider.getBalance(wallet.address, 'latest');
    const effPrice = feeOverrides.maxFeePerGas || feeOverrides.gasPrice || 0n;
    const reserve = hre.ethers.parseEther('0.005');
    const maxByBalance = effPrice > 0n && balance > reserve ? (balance - reserve) / effPrice : 3_000_000n;
    const fallbackGas = maxByBalance > 5_000_000n ? 5_000_000n : (maxByBalance < 2_500_000n ? 2_500_000n : maxByBalance);
    gasLimit = est ? (est + est / 5n) : fallbackGas;
    
    logger.info(`[MULTI_DBG] chainId=${chainId} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
  } catch (_) {
    if (process.env.TARGET_DLE_NONCE) throw _;
    gasLimit = 3_000_000n;
  }

  if (Number(chainId) === 1 && feeOverrides.maxFeePerGas && gasLimit) {
    const balForCap = await provider.getBalance(wallet.address, 'latest');
    const reserveCap = hre.ethers.parseEther('0.002');
    const affordable = gasLimit > 0n && balForCap > reserveCap ? (balForCap - reserveCap) / gasLimit : 0n;
    if (affordable > 0n && feeOverrides.maxFeePerGas > affordable) {
      logger.info(`[MULTI_DBG] chainId=1 cap maxFeePerGas ${feeOverrides.maxFeePerGas} → ${affordable}`);
      feeOverrides.maxFeePerGas = affordable;
      if (feeOverrides.maxPriorityFeePerGas && feeOverrides.maxPriorityFeePerGas >= affordable) {
        feeOverrides.maxPriorityFeePerGas = affordable / 2n || 1n;
      }
    }
  }

  // Вычисляем предсказанный адрес DLE с целевым nonce (детерминированный деплой)
  let predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: targetDLENonce
  });
  logger.info(`[MULTI_DBG] chainId=${chainId} predicted DLE address=${predictedAddress} (nonce=${targetDLENonce})`);

  // Проверяем, не развернут ли уже контракт
  const existingCode = await provider.getCode(predictedAddress);
  if (existingCode && existingCode !== '0x') {
    logger.info(`[MULTI_DBG] chainId=${chainId} DLE already exists at predictedAddress, skip deploy`);
    
    // Проверяем и инициализируем логотип для существующего контракта
    if (params.logoURI && params.logoURI !== '') {
      try {
        logger.info(`[MULTI_DBG] chainId=${chainId} checking logoURI for existing contract`);
        
        // Ждем 2 секунды для стабильности соединения
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const DLE = await hre.ethers.getContractFactory('contracts/DLE.sol:DLE');
        const dleContract = DLE.attach(predictedAddress);
        
        const currentLogo = await dleContract.logoURI();
        if (currentLogo === '' || currentLogo === '0x') {
          logger.info(`[MULTI_DBG] chainId=${chainId} initializing logoURI for existing contract: ${params.logoURI}`);
          const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
          await logoTx.wait();
          logger.info(`[MULTI_DBG] chainId=${chainId} logoURI initialized for existing contract`);
        } else {
          logger.info(`[MULTI_DBG] chainId=${chainId} logoURI already set: ${currentLogo}`);
        }
      } catch (error) {
        logger.info(`[MULTI_DBG] chainId=${chainId} logoURI initialization failed for existing contract: ${error.message}`);
      }
    }
    
    return { address: predictedAddress, chainId: chainId };
  }

  // Деплоим DLE с retry логикой для обработки race conditions
  let tx;
  let deployAttempts = 0;
  const maxDeployAttempts = 5;
  
  while (deployAttempts < maxDeployAttempts) {
    try {
      deployAttempts++;
      
      // Получаем актуальный nonce прямо перед отправкой транзакции
      const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 30000, maxRetries: 3 });
      logger.info(`[MULTI_DBG] chainId=${chainId} deploy attempt ${deployAttempts}/${maxDeployAttempts} with current nonce=${currentNonce} (target was ${targetDLENonce})`);
      
      // Если текущий nonce больше целевого, обновляем targetDLENonce
      if (currentNonce > targetDLENonce) {
        throw new Error(
          `CREATE nonce ${currentNonce} > target ${targetDLENonce} on chainId=${chainId}. Abort, чтобы не сменить адрес.`
        );
      }
      if (process.env.TARGET_DLE_NONCE && currentNonce !== Number(process.env.TARGET_DLE_NONCE)) {
        throw new Error(
          `CREATE nonce ${currentNonce} != required ${process.env.TARGET_DLE_NONCE} on chainId=${chainId}`
        );
      }
      
      const txData = {
        data: dleInit,
        nonce: currentNonce,
        gasLimit,
        ...feeOverrides
      };
      
      const rpcManager = new RPCConnectionManager();
      const result = await rpcManager.sendTransactionWithRetry(wallet, txData, { maxRetries: 3 });
      tx = result.tx;
      
      // Отмечаем транзакцию как pending в NonceManager
      nonceManager.markTransactionPending(wallet.address, chainId, currentNonce, tx.hash);
      
      logger.info(`[MULTI_DBG] chainId=${chainId} deploy successful on attempt ${deployAttempts}`);
      break; // Успешно отправили, выходим из цикла
      
    } catch (e) {
      const errorMsg = e?.message || e;
      logger.warn(`[MULTI_DBG] chainId=${chainId} deploy attempt ${deployAttempts} failed: ${errorMsg}`);
      
      // Проверяем, является ли это ошибкой nonce
      if (String(errorMsg).toLowerCase().includes('nonce too low') && deployAttempts < maxDeployAttempts) {
        logger.info(`[MULTI_DBG] chainId=${chainId} nonce race condition detected, retrying...`);
        
        // Используем NonceManager для обновления nonce
        nonceManager.resetNonce(wallet.address, chainId);
        const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 30000, maxRetries: 3 });
        logger.info(`[MULTI_DBG] chainId=${chainId} current nonce: ${currentNonce}, target was: ${targetDLENonce}`);
        
        if (process.env.TARGET_DLE_NONCE) {
          throw new Error(
            `nonce too low on chainId=${chainId} at required nonce ${process.env.TARGET_DLE_NONCE}; abort`
          );
        }
        throw new Error(
          `nonce too low on chainId=${chainId}: current=${currentNonce} target=${targetDLENonce}; abort, чтобы адреса не разъехались`
        );
      }
      
      // Если это не ошибка nonce или исчерпаны попытки, выбрасываем ошибку
      if (deployAttempts >= maxDeployAttempts) {
        throw new Error(`Deployment failed after ${maxDeployAttempts} attempts: ${errorMsg}`);
      }
      
      // Для других ошибок делаем короткую задержку и пробуем снова
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const rc = tx && typeof tx.wait === 'function' ? await tx.wait(2) : null;
  if (tx?.hash && tx.hash !== 'already-known') {
    nonceManager.markTransactionConfirmed(wallet.address, chainId, tx.hash);
  }
  let deployedAddress = rc?.contractAddress || predictedAddress;
  const codeAfter = await provider.getCode(deployedAddress);
  if (!codeAfter || codeAfter === '0x') {
    throw new Error(`CREATE nonce mined but no bytecode at ${deployedAddress} on chainId=${chainId}`);
  }
  
  // Проверяем, что адрес соответствует предсказанному
  if (deployedAddress !== predictedAddress) {
    logger.error(`[MULTI_DBG] chainId=${chainId} ADDRESS MISMATCH! predicted=${predictedAddress} actual=${deployedAddress}`);
    throw new Error(`Address mismatch: predicted ${predictedAddress} != actual ${deployedAddress}`);
  }
  
  logger.info(`[MULTI_DBG] chainId=${chainId} DLE deployed at=${deployedAddress} ✅`);
  
  // Инициализация логотипа если он указан
  if (params.logoURI && params.logoURI !== '') {
    try {
      logger.info(`[MULTI_DBG] chainId=${chainId} initializing logoURI: ${params.logoURI}`);
      
      // Ждем 5 секунд, чтобы контракт получил подтверждения
      logger.info(`[MULTI_DBG] chainId=${chainId} waiting 5 seconds for contract confirmations...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const DLE = await hre.ethers.getContractFactory('contracts/DLE.sol:DLE');
      const dleContract = DLE.attach(deployedAddress);
      
      // Проверяем текущий логотип перед инициализацией
      const currentLogo = await dleContract.logoURI();
      logger.info(`[MULTI_DBG] chainId=${chainId} current logoURI: ${currentLogo}`);
      
      if (currentLogo === '' || currentLogo === '0x') {
        logger.info(`[MULTI_DBG] chainId=${chainId} logoURI is empty, initializing...`);
        const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
        logger.info(`[MULTI_DBG] chainId=${chainId} logoURI transaction sent: ${logoTx.hash}`);
        await logoTx.wait(2); // Ждем 2 подтверждения с таймаутом
        logger.info(`[MULTI_DBG] chainId=${chainId} logoURI initialized successfully`);
      } else {
        logger.info(`[MULTI_DBG] chainId=${chainId} logoURI already set: ${currentLogo}, skipping initialization`);
      }
    } catch (error) {
      logger.error(`[MULTI_DBG] chainId=${chainId} logoURI initialization failed: ${error.message}`);
      logger.error(`[MULTI_DBG] chainId=${chainId} error stack: ${error.stack}`);
      // Не прерываем деплой из-за ошибки логотипа
    }
  } else {
    logger.info(`[MULTI_DBG] chainId=${chainId} no logoURI specified, skipping initialization`);
  }
  
  // Автоматическая верификация DLE контракта после успешного деплоя
  let verificationResult = { success: false, error: 'skipped' };
  
  if (etherscanKey || params.etherscanApiKey || params.etherscan_api_key) {
    try {
      logger.info(`🔍 Начинаем автоматическую верификацию DLE контракта...`);
      const creationTxData = (tx && tx.data) || dleInit;
      verificationResult = await verifyDLEAfterDeploy(
        Number(network.chainId),
        deployedAddress,
        creationTxData,
        etherscanKey || params.etherscanApiKey || params.etherscan_api_key,
        rpcUrl
      );
      
      if (verificationResult.success) {
        logger.info(`✅ DLE контракт верифицирован: ${deployedAddress}`);
      } else {
        logger.warn(`⚠️ Верификация DLE не удалась: ${verificationResult.error || verificationResult.message}`);
      }
    } catch (verificationError) {
      const errorMsg = verificationError.message || String(verificationError);
      const errorStack = verificationError.stack || 'No stack trace';
      logger.error(`❌ Ошибка при верификации DLE: ${errorMsg}`);
      logger.error(`❌ Стек ошибки верификации: ${errorStack}`);
      verificationResult = { success: false, error: errorMsg };
    }
  } else {
    logger.info(`ℹ️ API ключ Etherscan не предоставлен, пропускаем верификацию DLE`);
  }

    const finalChainId = Number(network.chainId);
    logger.info(`[MULTI_DBG] chainId=${finalChainId} Returning deployment result: address=${deployedAddress}`);
    return { 
      address: deployedAddress, 
      chainId: finalChainId,
      verification: verificationResult
    };
  } catch (error) {
    const errorMsg = error.message || String(error);
    const errorStack = error.stack || 'No stack trace';
    const chainIdStr = network?.chainId ? Number(network.chainId) : 'unknown';
    logger.error(`[MULTI_DBG] chainId=${chainIdStr} deployment failed: ${errorMsg}`);
    logger.error(`[MULTI_DBG] chainId=${chainIdStr} error stack: ${errorStack}`);
    throw error; // Перебрасываем ошибку для обработки в main()
  }
}


async function main() {
  console.log('[MULTI_DBG] 🚀 ВХОДИМ В ФУНКЦИЮ MAIN!');
  
  // 🔧 BEST PRACTICE: Настраиваем NO_PROXY перед деплоем
  try {
    const proxyManager = require('../../utils/proxyManager');
    await proxyManager.initialize();
    console.log('[MULTI_DBG] ✅ ProxyManager инициализирован');
  } catch (error) {
    console.warn('[MULTI_DBG] ⚠️ Не удалось инициализировать ProxyManager:', error.message);
  }
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
    etherscanApiKey: Boolean(params.etherscanApiKey || params.etherscan_api_key)
  });

  const pk = params.private_key || process.env.PRIVATE_KEY;
  
  // ИСПРАВЛЕНИЕ: Используем RPC URLs из deployParams, а не из rpcProviderService
  const networks = params.rpcUrls || params.rpc_urls || [];
  
  logger.info(`[MULTI_DBG] 📊 RPC URLs из deployParams: ${networks.length} сетей`);
  networks.forEach((url, i) => {
    logger.info(`[MULTI_DBG]   ${i + 1}. ${url}`);
  });
  
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
    initCodes[Number(chainId)] = deployTx.data;
  }
  
  // Получаем initCodeHash из первого initCode (все должны быть одинаковые по структуре)
  const firstChainId = Number(supportedChainIds[0]);
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

  const onlyChainId = process.env.ONLY_CHAIN_ID ? Number(process.env.ONLY_CHAIN_ID) : null;
  const rpcChainIds = onlyChainId
    ? supportedChainIds.map(Number).filter((id) => id === onlyChainId)
    : supportedChainIds.map(Number);
  if (onlyChainId && rpcChainIds.length === 0) {
    throw new Error(`ONLY_CHAIN_ID=${onlyChainId} нет в supportedChainIds=[${supportedChainIds.join(',')}]`);
  }
  if (onlyChainId) {
    logger.info(
      `[MULTI_DBG] ONLY_CHAIN_ID=${onlyChainId}: CREATE только в этой сети; конструктор без изменений (supportedChainIds=${JSON.stringify(supportedChainIds)})`
    );
  }

  // Подготовим провайдеры и вычислим общий nonce для DLE с retry логикой
  logger.info(`[MULTI_DBG] Создаем RPC соединения для ${rpcChainIds.length} сетей...`);
  const connections = await createMultipleRPCConnections(rpcChainIds, pk, {
    maxRetries: 3,
    timeout: 30000
  });
  
  if (connections.length === 0) {
    throw new Error('Не удалось установить ни одного RPC соединения');
  }
  
  logger.info(`[MULTI_DBG] ✅ Успешно подключились к ${connections.length}/${rpcChainIds.length} сетям`);
  
  // Очищаем старые pending транзакции для всех сетей
  for (const connection of connections) {
    const chainId = Number(connection.network.chainId);
    nonceManager.clearOldPendingTransactions(connection.wallet.address, chainId);
  }
  
  const nonces = [];
  for (const connection of connections) {
    logger.info(`[MULTI_DBG] Получаем nonce для connection: address=${connection.wallet.address}, rpcUrl=${connection.rpcUrl}, chainId=${Number(connection.network.chainId)}`);
    const n = await nonceManager.getNonce(connection.wallet.address, connection.rpcUrl, Number(connection.network.chainId));
    nonces.push(n);
  }
  const forcedNonce = process.env.TARGET_DLE_NONCE !== undefined && process.env.TARGET_DLE_NONCE !== ''
    ? Number(process.env.TARGET_DLE_NONCE)
    : null;
  const targetDLENonce = Number.isInteger(forcedNonce) ? forcedNonce : Math.max(...nonces);
  logger.info(`[MULTI_DBG] nonces=${JSON.stringify(nonces)} targetDLENonce=${targetDLENonce}${forcedNonce != null ? ' (TARGET_DLE_NONCE)' : ''}`);
  logger.info(`[MULTI_DBG] Starting deployment to ${connections.length} networks`);

  // Как на VDS: сразу параллельный CREATE; filler — внутри deployInNetwork.
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
      
      const r = await deployInNetwork(chainId, pk, initCodeHash, targetDLENonce, networkInitCode, params, dleConfig, initializer, etherscanKey);
      logger.info(`[MULTI_DBG] ✅ Network ${i + 1} (chainId: ${chainId}) deployment SUCCESS: ${r.address}`);
      return {
        rpcUrl, 
        chainId, 
        address: r.address, 
        success: true,
        verification: r.verification || { success: false, error: 'unknown' }
      };
    } catch (error) {
      const errorMsg = error.message || String(error);
      const errorStack = error.stack || 'No stack trace';
      logger.error(`[MULTI_DBG] ❌ Network ${i + 1} (chainId: ${chainId}) deployment FAILED: ${errorMsg}`);
      logger.error(`[MULTI_DBG] ❌ Network ${i + 1} (chainId: ${chainId}) error stack: ${errorStack}`);
      return { rpcUrl, chainId, error: errorMsg, success: false };
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
  
  // Логируем все результаты для отладки
  logger.info('[MULTI_DBG] Raw results:', JSON.stringify(results, null, 2));
  
  // Проверяем, что все адреса одинаковые (критично для детерминированного деплоя)
  const successfulResults = results.filter(r => r.success === true);
  const addresses = successfulResults.map(r => r.address).filter(addr => addr);
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

  if (successfulResults.length !== results.length || results.length !== rpcChainIds.length) {
    const failed = results.filter((r) => r.success !== true);
    throw new Error(
      `Partial multichain deploy: ${successfulResults.length}/${rpcChainIds.length} chains. Failed: ${failed.map((f) => `${f.chainId}: ${f.error}`).join('; ')}`
    );
  }
  
  logger.info('[MULTI_DBG] SUCCESS: All DLE addresses are identical:', uniqueAddresses[0]);
  
  // Верификация уже выполнена в процессе деплоя
  const finalResults = results.map((result) => ({
    ...result,
    verification: result.verification || { success: false, error: 'not_attempted' }
  }));
  
  // ВЫВОДИМ РЕЗУЛЬТАТ С ИНТЕГРИРОВАННОЙ ВЕРИФИКАЦИЕЙ!
  // Важно: используем process.stdout.write, чтобы обойти маскирование адресов (logger/console)
  logger.info('[MULTI_DBG] 🎯 ДОШЛИ ДО ВЫВОДА РЕЗУЛЬТАТА!');
  logger.info('[MULTI_DBG] 📊 finalResults:', finalResults);
  logger.info('[MULTI_DBG] 🎯 ВЫВОДИМ MULTICHAIN_DEPLOY_RESULT!');

  const rawResult = JSON.stringify(finalResults);
  // Эту строку парсят unifiedDeploymentService и dleV2Service по шаблону /MULTICHAIN_DEPLOY_RESULT\\s+(.+)/
  process.stdout.write(`MULTICHAIN_DEPLOY_RESULT ${rawResult}\n`);

  logger.info('[MULTI_DBG] ✅ MULTICHAIN_DEPLOY_RESULT ВЫВЕДЕН!');
  logger.info('[MULTI_DBG] DLE deployment completed successfully with integrated verification!');
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
  
  // Даже в случае ошибки выводим сырой результат без маскирования
  const rawError = JSON.stringify([errorResult]);
  process.stdout.write(`MULTICHAIN_DEPLOY_RESULT ${rawError}\n`);
  process.exit(1); 
});


