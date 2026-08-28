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
const hre = require('hardhat');
const path = require('path');
const fs = require('fs');
const logger = require('../../utils/logger');
const { getFeeOverrides, createProviderAndWallet, getNetworkInfo, createRPCConnection, createMultipleRPCConnections } = require('../../utils/deploymentUtils');
const RPCConnectionManager = require('../../utils/rpcConnectionManager');
const { nonceManager, MAX_NONCE_FILLERS } = require('../../utils/nonceManager');
const { verifyWithStandardJson } = require('../../utils/etherscanStandardJsonVerify');

/** RPC из формы настроек книги (ETHEREUM_NETWORK_URL), иначе RPC узла. */
const rpcDeployOverrides = { rpcUrlsByChainId: {} };

// WebSocket сервис удален - логи отправляются через главный процесс

// Сервис для верификации контрактов
// ContractVerificationService удален - используем Hardhat verify

// Конфигурация модулей для деплоя
const MODULE_CONFIGS = {
  treasury: {
    contractName: 'TreasuryModule',
    constructorArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress, // _dleContract
      chainId, // _chainId
      walletAddress // _emergencyAdmin
    ],
    verificationArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress, // _dleContract
      chainId, // _chainId
      walletAddress // _emergencyAdmin
    ]
  },
  timelock: {
    contractName: 'TimelockModule',
    constructorArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ],
    verificationArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ]
  },
  reader: {
    contractName: 'DLEReader',
    constructorArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ],
    verificationArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ]
  },
  hierarchicalVoting: {
    contractName: 'HierarchicalVotingModule',
    constructorArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ],
    verificationArgs: (dleAddress, chainId, walletAddress) => [
      dleAddress // _dleContract
    ]
  }
  // Здесь можно легко добавлять новые модули:
  // newModule: {
  //   contractName: 'NewModule',
  //   constructorArgs: (dleAddress, ...otherArgs) => [dleAddress, ...otherArgs],
  //   verificationArgs: (dleAddress, ...otherArgs) => [dleAddress, ...otherArgs]
  // }
};

// Функция для автоматической верификации модуля
async function verifyModuleAfterDeploy(chainId, contractAddress, moduleType, constructorArgs, apiKey, params = {}, creationTxData = null) {
  try {
    if (!apiKey) {
      logger.warn(`⚠️ API ключ Etherscan не предоставлен, пропускаем верификацию модуля ${moduleType}`);
      return { success: false, error: 'API ключ не предоставлен' };
    }

    const moduleConfig = MODULE_CONFIGS[moduleType];
    const contractName = moduleConfig?.contractName;
    if (!contractName) {
      return { success: false, error: `Unknown module type: ${moduleType}` };
    }

    logger.info(`🔍 Верификация модуля ${moduleType} ${contractAddress} chainId=${chainId} (standard-JSON artifact)`);
    const result = await verifyWithStandardJson({
      chainId: Number(chainId),
      contractAddress,
      fullyQualifiedName: `contracts/${contractName}.sol:${contractName}`,
      apiKey,
      creationTxData,
      rpcUrl: params.rpcUrl,
    });
    if (result.success) return result;
    const onExplorer = await isSourcePublishedOnExplorer(chainId, contractAddress, apiKey);
    if (onExplorer) {
      return { success: true, message: 'Исходники уже на explorer' };
    }
    return result;
  } catch (error) {
    const msg = error.message || String(error);
    if (/already verified/i.test(msg)) {
      return { success: true, message: 'Already verified' };
    }
    const onExplorer = await isSourcePublishedOnExplorer(chainId, contractAddress, apiKey);
    if (onExplorer) {
      return { success: true, message: 'Исходники уже на explorer' };
    }
    logger.warn(`Верификация модуля ${moduleType} не подтверждена: ${msg}`);
    return { success: false, error: msg };
  }
}

/** Explorer UI может быть зелёным при Sourcify, пока hardhat-verify ловит HTML от API. */
async function isSourcePublishedOnExplorer(chainId, contractAddress, apiKey) {
  if (!apiKey || !contractAddress) return false;
  const url =
    `https://api.etherscan.io/v2/api?chainid=${Number(chainId)}` +
    `&module=contract&action=getsourcecode&address=${contractAddress}&apikey=${encodeURIComponent(apiKey)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    if (!text || text.trimStart().startsWith('<')) return false;
    const json = JSON.parse(text);
    const source = json?.result?.[0]?.SourceCode;
    return typeof source === 'string' && source.length > 2;
  } catch {
    return false;
  }
}

// Деплой модуля в одной сети (CREATE + выравнивание nonce)
async function deployModuleInNetwork(rpcUrl, pk, salt, initCodeHash, targetNonce, moduleInit, moduleType, knownChainId) {
  const { ethers } = hre;
  
  const chainId = Number(knownChainId);
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`deployModuleInNetwork: некорректный chainId=${knownChainId}`);
  }
  
  const { provider, wallet, network: rpcNetwork } = await createRPCConnection(chainId, pk, {
    maxRetries: 3,
    timeout: 30000,
    ...rpcDeployOverrides,
  });
  
  const net = rpcNetwork;
  const feeOpts = chainId === 1 ? { minFeeGwei: 1n, minPriorityGwei: 1n } : {};
  
  // 1) Используем NonceManager для правильного управления nonce
  logger.info(`[MODULES_DBG] chainId=${chainId} deploying ${moduleType}...`);
  let current = await nonceManager.getNonce(wallet.address, rpcUrl, chainId);
  logger.info(`[MODULES_DBG] chainId=${chainId} current nonce=${current} target=${targetNonce}`);
  
  if (current > targetNonce) {
    throw new Error(`Current nonce ${current} > targetNonce ${targetNonce} on chainId=${chainId}`);
  }
  
  if (current < targetNonce) {
    const need = targetNonce - current;
    if (need > MAX_NONCE_FILLERS) {
      throw new Error(
        `[MODULES_DBG] chainId=${chainId}: gap=${need} filler tx (лимит ${MAX_NONCE_FILLERS}). ` +
          `Выровняйте nonce скриптом или уменьшите число сетей.`
      );
    }
    logger.info(`[MODULES_DBG] chainId=${chainId} aligning nonce from ${current} to ${targetNonce} (${need} transactions needed)`);
    
    // Используем burn address для более надежных транзакций
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    
    while (current < targetNonce) {
      const overrides = await getFeeOverrides(provider, feeOpts);
      let gasLimit = 21000; // минимальный gas для обычной транзакции
      let sent = false;
      let lastErr = null;
      
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        try {
          const txReq = {
            to: burnAddress,
            value: 0n,
            nonce: current,
            gasLimit,
            ...overrides
          };
          logger.info(`[MODULES_DBG] chainId=${chainId} sending filler tx nonce=${current} attempt=${attempt + 1}`);
          const rpcManager = new RPCConnectionManager();
          const { tx: txFill, receipt } = await rpcManager.sendTransactionWithRetry(wallet, txReq, { maxRetries: 3 });
          logger.info(`[MODULES_DBG] chainId=${chainId} filler tx sent, hash=${txFill.hash}, waiting for confirmation...`);
          logger.info(`[MODULES_DBG] chainId=${chainId} filler tx nonce=${current} confirmed, hash=${txFill.hash}`);
          sent = true;
        } catch (e) {
          lastErr = e;
          logger.info(`[MODULES_DBG] chainId=${chainId} filler tx nonce=${current} attempt=${attempt + 1} failed: ${e?.message || e}`);
          
          if (String(e?.message || '').toLowerCase().includes('intrinsic gas too low') && attempt < 2) {
            gasLimit = 50000;
            continue;
          }
          
          if (String(e?.message || '').toLowerCase().includes('nonce too low') && attempt < 2) {
            // Сбрасываем кэш и получаем актуальный nonce
            nonceManager.resetNonce(wallet.address, chainId);
            current = await provider.getTransactionCount(wallet.address, 'pending');
            logger.info(`[MODULES_DBG] chainId=${chainId} updated nonce to ${current}`);
            
            // Если новый nonce больше целевого, это критическая ошибка
            if (current > targetNonce) {
              throw new Error(`Current nonce ${current} > target nonce ${targetNonce} on chainId=${chainId}. Cannot proceed with module deployment.`);
            }
            
            continue;
          }
          
          throw e;
        }
      }
      
      if (!sent) {
        logger.error(`[MODULES_DBG] chainId=${chainId} failed to send filler tx for nonce=${current}`);
        throw lastErr || new Error('filler tx failed');
      }
      
      current++;
    }
    
    logger.info(`[MODULES_DBG] chainId=${chainId} nonce alignment completed, current nonce=${current}`);
  } else {
    logger.info(`[MODULES_DBG] chainId=${chainId} nonce already aligned at ${current}`);
  }

  // 2) Деплой модуля напрямую на согласованном nonce
  logger.info(`[MODULES_DBG] chainId=${chainId} deploying ${moduleType} directly with nonce=${targetNonce}`);
  
  const feeOverrides = await getFeeOverrides(provider, feeOpts);
  let gasLimit;
  
  try {
    // Оцениваем газ для деплоя модуля
    const est = await wallet.estimateGas({ data: moduleInit, ...feeOverrides }).catch(() => null);
    
    // Рассчитываем доступный gasLimit из баланса
    const balance = await provider.getBalance(wallet.address, 'latest');
    const effPrice = feeOverrides.maxFeePerGas || feeOverrides.gasPrice || 0n;
    const reserve = hre.ethers.parseEther('0.005');
    const maxByBalance = effPrice > 0n && balance > reserve ? (balance - reserve) / effPrice : 1_000_000n;
    const fallbackGas = maxByBalance > 2_000_000n ? 2_000_000n : (maxByBalance < 500_000n ? 500_000n : maxByBalance);
    gasLimit = est ? (est + est / 5n) : fallbackGas;
    
    logger.info(`[MODULES_DBG] chainId=${chainId} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
  } catch (_) {
    gasLimit = 1_000_000n;
  }

  if (Number(chainId) === 1 && feeOverrides.maxFeePerGas && gasLimit) {
    const balForCap = await provider.getBalance(wallet.address, 'latest');
    const reserveCap = hre.ethers.parseEther('0.002');
    const affordable = gasLimit > 0n && balForCap > reserveCap ? (balForCap - reserveCap) / gasLimit : 0n;
    if (affordable > 0n && feeOverrides.maxFeePerGas > affordable) {
      logger.info(`[MODULES_DBG] chainId=1 cap maxFeePerGas ${feeOverrides.maxFeePerGas} → ${affordable}`);
      feeOverrides.maxFeePerGas = affordable;
      if (feeOverrides.maxPriorityFeePerGas && feeOverrides.maxPriorityFeePerGas >= affordable) {
        feeOverrides.maxPriorityFeePerGas = affordable / 2n || 1n;
      }
    }
  }

  // Вычисляем предсказанный адрес модуля
  const predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: targetNonce
  });
  logger.info(`[MODULES_DBG] chainId=${chainId} predicted ${moduleType} address=${predictedAddress}`);

  // Проверяем, не развернут ли уже контракт
  const existingCode = await provider.getCode(predictedAddress);
  if (existingCode && existingCode !== '0x') {
    logger.info(`[MODULES_DBG] chainId=${chainId} ${moduleType} already exists at predictedAddress, skip deploy`);
    return { address: predictedAddress, chainId: chainId };
  }

  // Деплоим модуль с retry логикой для обработки race conditions
  let tx;
  let deployAttempts = 0;
  const maxDeployAttempts = 5;
  
  while (deployAttempts < maxDeployAttempts) {
    try {
      deployAttempts++;
      
      // Получаем актуальный nonce прямо перед отправкой транзакции
      const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 30000, maxRetries: 3 });
      logger.info(`[MODULES_DBG] chainId=${chainId} deploy attempt ${deployAttempts}/${maxDeployAttempts} with current nonce=${currentNonce} (target was ${targetNonce})`);
      
      if (currentNonce !== targetNonce) {
        throw new Error(
          `CREATE ${moduleType} nonce ${currentNonce} != target ${targetNonce} on chainId=${chainId}`
        );
      }
      
      const txData = {
        data: moduleInit,
        nonce: targetNonce,
        gasLimit,
        ...feeOverrides
      };
      
      const rpcManager = new RPCConnectionManager();
      const result = await rpcManager.sendTransactionWithRetry(wallet, txData, { maxRetries: 3 });
      tx = result.tx;
      
      logger.info(`[MODULES_DBG] chainId=${chainId} deploy successful on attempt ${deployAttempts}`);
      break; // Успешно отправили, выходим из цикла
      
    } catch (e) {
      const errorMsg = e?.message || e;
      logger.warn(`[MODULES_DBG] chainId=${chainId} deploy attempt ${deployAttempts} failed: ${errorMsg}`);
      
      // Проверяем, является ли это ошибкой nonce
      if (String(errorMsg).toLowerCase().includes('nonce too low') && deployAttempts < maxDeployAttempts) {
        logger.info(`[MODULES_DBG] chainId=${chainId} nonce race condition detected, retrying...`);
        
        // Получаем актуальный nonce из сети
        const currentNonce = await nonceManager.getNonce(wallet.address, rpcUrl, chainId, { timeout: 30000, maxRetries: 3 });
        logger.info(`[MODULES_DBG] chainId=${chainId} current nonce: ${currentNonce}, target: ${targetNonce}`);
        
        // Если текущий nonce больше целевого, обновляем targetNonce
        if (currentNonce > targetNonce) {
          throw new Error(
            `Nonce ${currentNonce} > target ${targetNonce} on chainId=${chainId}. Останавливаем, чтобы адреса модулей на сетях не разъехались.`
          );
        }
        
        // Если текущий nonce меньше целевого, выравниваем его
        if (currentNonce < targetNonce) {
          logger.info(`[MODULES_DBG] chainId=${chainId} aligning nonce from ${currentNonce} to ${targetNonce}`);
          const rpcManagerFill = new RPCConnectionManager();
          for (let i = currentNonce; i < targetNonce; i++) {
            try {
              const { tx: fillerTx } = await rpcManagerFill.sendTransactionWithRetry(wallet, {
                to: '0x000000000000000000000000000000000000dEaD',
                value: 0n,
                gasLimit: 21000,
                nonce: i,
                ...feeOverrides
              }, { maxRetries: 3 });
              logger.info(`[MODULES_DBG] chainId=${chainId} filler tx ${i} confirmed, hash=${fillerTx.hash}`);
              nonceManager.reserveNonce(wallet.address, chainId, i);
            } catch (fillerError) {
              const fmsg = String(fillerError?.message || fillerError).toLowerCase();
              if (fmsg.includes('already known') || fmsg.includes('nonce too low') || fmsg.includes('known transaction')) {
                nonceManager.resetNonce(wallet.address, chainId);
                logger.warn(`[MODULES_DBG] chainId=${chainId} filler ${i} already in mempool, continue`);
                continue;
              }
              logger.error(`[MODULES_DBG] chainId=${chainId} filler tx ${i} failed: ${fillerError.message}`);
              throw fillerError;
            }
          }
        }
        
        // Не поднимаем targetNonce: CREATE на сетях должен идти с одним nonce.
        
        // Короткая задержка перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Если это не ошибка nonce или исчерпаны попытки, выбрасываем ошибку
      if (deployAttempts >= maxDeployAttempts) {
        throw new Error(`Module deployment failed after ${maxDeployAttempts} attempts: ${errorMsg}`);
      }
      
      // Для других ошибок делаем короткую задержку и пробуем снова
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const rc = tx && typeof tx.wait === 'function' ? await tx.wait() : null;
  const deployedAddress = rc?.contractAddress || predictedAddress;
  const codeAfter = await provider.getCode(deployedAddress);
  if (!codeAfter || codeAfter === '0x') {
    throw new Error(`CREATE ${moduleType} mined but no bytecode at ${deployedAddress} on chainId=${chainId}`);
  }
  
  logger.info(`[MODULES_DBG] chainId=${chainId} ${moduleType} deployed at=${deployedAddress}`);
  return { address: deployedAddress, chainId: chainId };
}

/**
 * Деплой тонкого ModuleBridge + wiring (setFundsBridge / setModuleBridge).
 * Вызывать ПОСЛЕ деплоя всех модулей в сети, чтобы не сдвинуть CREATE2 nonce.
 */
const MODULE_BRIDGE_CONFIG = {
  treasury: {
    bridgeContract: 'TreasuryBridge',
    setter: 'setFundsBridge(address)',
  },
  timelock: {
    bridgeContract: 'TimelockBridge',
    setter: 'setModuleBridge(address)',
  },
  hierarchicalVoting: {
    bridgeContract: 'HierarchicalVotingBridge',
    setter: 'setModuleBridge(address)',
  },
  reader: {
    bridgeContract: 'ReaderBridge',
    setter: 'setModuleBridge(address)',
  },
};

async function deployAndWireModuleBridge({
  chainId,
  pk,
  moduleType,
  dleAddress,
  moduleAddress,
  walletAddress,
}) {
  const { ethers } = hre;
  const cfg = MODULE_BRIDGE_CONFIG[moduleType];
  if (!cfg) {
    return { bridgeAddress: null, wired: false, skipped: true };
  }

  const { provider, wallet } = await createRPCConnection(chainId, pk, {
    maxRetries: 3,
    timeout: 30000,
    ...rpcDeployOverrides,
  });

  const BridgeFactory = await hre.ethers.getContractFactory(cfg.bridgeContract);
  const feeOverrides = await getFeeOverrides(
    provider,
    Number(chainId) === 1 ? { minFeeGwei: 1n, minPriorityGwei: 1n } : {}
  );
  const bridge = await BridgeFactory.connect(wallet).deploy(dleAddress, moduleAddress, feeOverrides);
  await bridge.waitForDeployment();
  const bridgeAddress = await bridge.getAddress();
  logger.info(
    `[MODULES_DBG] chainId=${chainId} ${cfg.bridgeContract} deployed at ${bridgeAddress} for ${moduleType}`
  );

  const module = await ethers.getContractAt(
    [
      `function ${cfg.setter}`,
      'function moduleBridge() view returns (address)',
      'function fundsBridge() view returns (address)',
    ],
    moduleAddress,
    wallet
  );

  let wired = false;
  try {
    const setterName = cfg.setter.split('(')[0];
    const tx = await module[setterName](bridgeAddress, feeOverrides);
    await tx.wait();
    wired = true;
    logger.info(`[MODULES_DBG] chainId=${chainId} ${setterName} OK → ${bridgeAddress}`);
  } catch (e) {
    logger.warn(
      `[MODULES_DBG] chainId=${chainId} wire ${moduleType} bridge failed: ${e.message}`
    );
  }

  let onChainBridge = ethers.ZeroAddress;
  try {
    onChainBridge = await module.moduleBridge();
  } catch (_) {
    try {
      onChainBridge = await module.fundsBridge();
    } catch (__) {}
  }

  return {
    bridgeAddress,
    wired: wired || String(onChainBridge).toLowerCase() === String(bridgeAddress).toLowerCase(),
    deployer: walletAddress || wallet.address,
  };
}


// Деплой всех модулей в одной сети
async function deployAllModulesInNetwork(chainId, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces, params) {
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
    timeout: 30000,
    ...rpcDeployOverrides,
  });
  
  const net = network;
  const numericChainId = Number(net.chainId);

  logger.info(`[MODULES_DBG] chainId=${numericChainId} deploying modules: ${modulesToDeploy.join(', ')}`);
  
  const results = {};
  
  for (let i = 0; i < modulesToDeploy.length; i++) {
    const moduleType = modulesToDeploy[i];
    const moduleInit = moduleInits[moduleType];
    const targetNonce = targetNonces[moduleType];
    
    // Логирование деплоя модуля
    logger.info(`[MODULES_DBG] Деплой модуля ${moduleType} в сети ${net.name || net.chainId}`);
    
    if (!MODULE_CONFIGS[moduleType]) {
      throw new Error(`Unknown module type: ${moduleType} on chainId=${numericChainId}`);
    }
    
    if (!moduleInit) {
      throw new Error(`No init code for module: ${moduleType} on chainId=${numericChainId}`);
    }
    
    try {
      const result = await deployModuleInNetwork(rpcUrl, pk, salt, null, targetNonce, moduleInit, moduleType, numericChainId);
      results[moduleType] = { ...result, success: true };
      logger.info(`[MODULES_DBG] Модуль ${moduleType} успешно задеплоен в сети ${net.name || net.chainId}: ${result.address}`);
    } catch (error) {
      logger.error(`[MODULES_DBG] chainId=${numericChainId} ${moduleType} deployment failed:`, error.message);
      throw error;
    }
  }

  // После модулей: ModuleBridge на каждый успешный модуль (не трогает precomputed nonce модулей)
  for (const moduleType of Object.keys(results)) {
    const mod = results[moduleType];
    if (!(mod && mod.success && mod.address && MODULE_BRIDGE_CONFIG[moduleType])) continue;
    try {
      const bridgeInfo = await deployAndWireModuleBridge({
        chainId: numericChainId,
        pk,
        moduleType,
        dleAddress,
        moduleAddress: mod.address,
        walletAddress: wallet.address,
      });
      results[moduleType].bridgeAddress = bridgeInfo.bridgeAddress;
      results[moduleType].bridgeWired = bridgeInfo.wired;
      logger.info(
        `[MODULES_DBG] ${moduleType} bridge ${bridgeInfo.bridgeAddress} (wired=${bridgeInfo.wired})`
      );
    } catch (bridgeErr) {
      results[moduleType].bridgeError = bridgeErr.message;
      logger.error(`[MODULES_DBG] ${moduleType} bridge failed: ${bridgeErr.message}`);
      throw new Error(`${moduleType} bridge failed on chainId=${numericChainId}: ${bridgeErr.message}`);
    }
  }
  
  return {
    chainId: chainId,
    modules: results
  };
}


// Деплой всех модулей во всех сетях
async function deployAllModulesInAllNetworks(networks, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces) {
  const results = [];
  
  // Функция больше не используется (логика деплоя реализована через connections в main)
  // Оставлена для совместимости.
  return [];
}

async function main() {
  // 🔧 BEST PRACTICE: Настраиваем NO_PROXY перед деплоем
  try {
    const proxyManager = require('../../utils/proxyManager');
    await proxyManager.initialize();
    console.log('[MODULES_DBG] ✅ ProxyManager инициализирован');
  } catch (error) {
    console.warn('[MODULES_DBG] ⚠️ Не удалось инициализировать ProxyManager:', error.message);
  }
  
  const { ethers } = hre;
  
  // Обрабатываем аргументы командной строки и переменные окружения
  const args = process.argv.slice(2);
  let moduleTypeFromArgs = null;
  
  // Сначала проверяем переменные окружения
  if (process.env.MODULE_TYPE) {
    moduleTypeFromArgs = process.env.MODULE_TYPE;
    logger.info(`🔍 Модуль из переменной окружения: ${moduleTypeFromArgs}`);
  } else {
    // Затем проверяем аргументы командной строки
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--module-type' && i + 1 < args.length) {
        moduleTypeFromArgs = args[i + 1];
        break;
      }
    }
  }
  
  // Загружаем параметры из базы данных или файла
  let params;
  
  try {
    // Пытаемся загрузить из базы данных
    const DeployParamsService = require('../../services/deployParamsService');
    const deployParamsService = new DeployParamsService();
    
    // Проверяем, передан ли конкретный deploymentId
    const deploymentId = process.env.DEPLOYMENT_ID;
    if (deploymentId && deploymentId !== 'latest') {
      logger.info(`🔍 Ищем параметры для deploymentId: ${deploymentId}`);
      params = await deployParamsService.getDeployParams(deploymentId);
      if (params) {
        logger.info('✅ Параметры загружены из базы данных по deploymentId');
      } else {
        throw new Error(`Параметры деплоя не найдены для deploymentId: ${deploymentId}`);
      }
    } else {
      // Получаем последние параметры деплоя
      logger.info(`🔍 Получаем последние параметры деплоя (deploymentId: ${deploymentId})`);
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        params = latestParams[0];
        const dleAttachService = require('../../services/dleAttachService');
        const needle = dleAttachService.normalizeAddress(process.env.DLE_ADDRESS);
        const rowAddr = dleAttachService.normalizeAddress(params.dleAddress || params.dle_address);
        if (needle && rowAddr && needle !== rowAddr) {
          throw new Error('DEPLOYMENT_ID=latest указывает на другую книгу. Задайте id записи этой книги.');
        }
        logger.info('✅ Параметры загружены из базы данных (последние)');
      } else {
        throw new Error('Параметры деплоя не найдены в базе данных');
      }
    }
    
    await deployParamsService.close();
  } catch (dbError) {
    logger.error('❌ Критическая ошибка: не удалось загрузить параметры из БД:', dbError.message);
    logger.error('❌ Система должна использовать только базу данных для хранения параметров деплоя');
    throw new Error(`Не удалось загрузить параметры деплоя из БД: ${dbError.message}. Система должна использовать только базу данных.`);
  }
  logger.info('[MODULES_DBG] Загружены параметры:', {
    name: params.name,
    symbol: params.symbol,
    supportedChainIds: params.supportedChainIds,
    CREATE2_SALT: params.CREATE2_SALT
  });

  // CREATE + выравнивание nonce на кошельке ДЕПЛОЯ. Не подставлять посторонний ключ ОС: его tx сдвинет nonce.
  // его tx сдвинет nonce и адреса модулей на сетях разъедутся.
  const pk = params.privateKey || params.private_key || process.env.PRIVATE_KEY;
  const pkSource = (params.privateKey || params.private_key)
    ? 'deploy_params'
    : process.env.PRIVATE_KEY
      ? 'PRIVATE_KEY'
      : 'none';
  const networks = params.rpcUrls || params.rpc_urls || [];
  const supportedChainIds = params.supportedChainIds || [];
  const dleAddress = params.dleAddress;
  const salt = params.CREATE2_SALT || params.create2_salt
    || `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const rpcUrlMap = (() => {
    try {
      return require('../../services/dleAttachService').parseRpcUrlMap(params.rpcUrls || params.rpc_urls);
    } catch {
      return {};
    }
  })();
  rpcDeployOverrides.rpcUrlsByChainId = rpcUrlMap;
  const rpcConnectOpts = { maxRetries: 3, timeout: 30000, ...rpcDeployOverrides };
  
  // Модули для деплоя (приоритет: аргументы командной строки > параметры из БД > по умолчанию)
  let modulesToDeploy;
  if (moduleTypeFromArgs) {
    modulesToDeploy = [moduleTypeFromArgs];
    logger.info(`[MODULES_DBG] Деплой конкретного модуля: ${moduleTypeFromArgs}`);
  } else if (params.modulesToDeploy && params.modulesToDeploy.length > 0) {
    modulesToDeploy = params.modulesToDeploy;
    logger.info(`[MODULES_DBG] Деплой модулей из БД: ${modulesToDeploy.join(', ')}`);
  } else {
    modulesToDeploy = ['treasury', 'timelock', 'reader'];
    logger.info(`[MODULES_DBG] Деплой модулей по умолчанию: ${modulesToDeploy.join(', ')}`);
  }
  
  if (!pk) throw new Error('PRIVATE_KEY not found in params or environment');
  if (!dleAddress) throw new Error('DLE_ADDRESS not found in params');
  const hasRpc = Array.isArray(networks)
    ? networks.length > 0
    : Object.keys(rpcUrlMap).length > 0 || (networks && typeof networks === 'object' && Object.keys(networks).length > 0);
  if (!hasRpc) throw new Error('RPC URLs not found in params');

  logger.info(`[MODULES_DBG] Starting modules deployment to ${networks.length} networks`);
  logger.info(`[MODULES_DBG] DLE Address: ${dleAddress}`);
  logger.info(`[MODULES_DBG] Modules to deploy: ${modulesToDeploy.join(', ')}`);
  logger.info(`[MODULES_DBG] Networks:`, networks);
  logger.info(`[MODULES_DBG] Using signer from: ${pkSource}`);
  
  // Уведомляем WebSocket клиентов о начале деплоя
  if (moduleTypeFromArgs) {
    logger.info(`[MODULES_DBG] Начало деплоя модуля ${moduleTypeFromArgs}`);
  } else {
    logger.info(`[MODULES_DBG] Начало деплоя модулей: ${modulesToDeploy.join(', ')}`);
  }
  
  // Устанавливаем API ключ Etherscan из базы данных, если доступен
  const ApiKeyManager = require('../../utils/apiKeyManager');
  const etherscanKey = ApiKeyManager.getAndSetEtherscanApiKey(params);
  
  if (etherscanKey) {
    logger.info(`[MODULES_DBG] Using Etherscan API key from database`);
  }

  // Проверяем, что все модули поддерживаются
  const unsupportedModules = modulesToDeploy.filter(module => !MODULE_CONFIGS[module]);
  if (unsupportedModules.length > 0) {
    throw new Error(`Unsupported modules: ${unsupportedModules.join(', ')}. Available modules: ${Object.keys(MODULE_CONFIGS).join(', ')}`);
  }

  // Подготовим init код для каждого модуля
  const moduleInits = {};
  const moduleInitCodeHashes = {};
  
  for (const moduleType of modulesToDeploy) {
    const moduleConfig = MODULE_CONFIGS[moduleType];
    const ContractFactory = await hre.ethers.getContractFactory(moduleConfig.contractName);
    
    // Получаем аргументы конструктора для первой сети (для расчета init кода)
    const firstConnection = await createRPCConnection(supportedChainIds[0], pk, rpcConnectOpts);
    const firstProvider = firstConnection.provider;
    const firstWallet = firstConnection.wallet;
    const firstNetwork = firstConnection.network;
    
    // Получаем аргументы конструктора
    const constructorArgs = moduleConfig.constructorArgs(dleAddress, Number(firstNetwork.chainId), firstWallet.address);
    
    logger.info(`[MODULES_DBG] ${moduleType} constructor args:`, constructorArgs);
    
    const deployTx = await ContractFactory.getDeployTransaction(...constructorArgs);
    moduleInits[moduleType] = deployTx.data;
    moduleInitCodeHashes[moduleType] = ethers.keccak256(deployTx.data);
    
    logger.info(`[MODULES_DBG] ${moduleType} init code prepared, hash: ${moduleInitCodeHashes[moduleType]}`);
  }

  // Подготовим провайдеры и вычислим общие nonce для каждого модуля
  // Создаем RPC соединения с retry логикой
  logger.info(`[MODULES_DBG] Создаем RPC соединения для ${supportedChainIds.length} сетей...`);
  const connections = await createMultipleRPCConnections(supportedChainIds, pk, rpcConnectOpts);
  
  if (connections.length === 0) {
    throw new Error('Не удалось установить ни одного RPC соединения');
  }
  
  if (connections.length !== supportedChainIds.length) {
    throw new Error(
      `RPC не для всех сетей модулей: ${connections.length}/${supportedChainIds.length}`
    );
  }
  logger.info(`[MODULES_DBG] ✅ Подключились ко всем ${connections.length} сетям`);
  
  const nonces = [];
  for (const connection of connections) {
    const n = await nonceManager.getNonce(
      connection.wallet.address,
      connection.rpcUrl,
      Number(connection.network.chainId)
    );
    nonces.push(n);
  }
  
  // Вычисляем target nonce для каждого модуля
  const targetNonces = {};
  let currentMaxNonce = Math.max(...nonces);
  
  for (const moduleType of modulesToDeploy) {
    targetNonces[moduleType] = currentMaxNonce;
    currentMaxNonce++; // каждый следующий модуль получает nonce +1
  }
  
  logger.info(`[MODULES_DBG] nonces=${JSON.stringify(nonces)} targetNonces=${JSON.stringify(targetNonces)}`);

  // ПАРАЛЛЕЛЬНЫЙ деплой всех модулей во всех сетях одновременно
  logger.info(`[MODULES_DBG] Starting PARALLEL deployment of all modules to ${connections.length} networks`);
  
  const deploymentPromises = connections.map(async (connection, networkIndex) => {
    logger.info(`[MODULES_DBG] 🚀 Starting deployment to network ${networkIndex + 1}/${connections.length}: ${connection.rpcUrl}`);
    
    try {
      const chainId = Number(connection.network.chainId);
      
      logger.info(`[MODULES_DBG] 📡 Network ${networkIndex + 1} chainId: ${chainId}`);
      
      const result = await deployAllModulesInNetwork(chainId, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces, params);
      logger.info(`[MODULES_DBG] ✅ Network ${networkIndex + 1} (chainId: ${chainId}) deployment SUCCESS`);
      return { rpcUrl: connection.rpcUrl, chainId, ...result };
    } catch (error) {
      logger.error(`[MODULES_DBG] ❌ Network ${networkIndex + 1} deployment FAILED:`, error.message);
      return { rpcUrl: connection.rpcUrl, error: error.message };
    }
  });
  
  // Ждем завершения всех деплоев
  const deployResults = await Promise.all(deploymentPromises);
  logger.info(`[MODULES_DBG] All ${connections.length} deployments completed`);

  const failedNetworks = deployResults.filter((r) => r.error || !r.modules);
  if (failedNetworks.length > 0) {
    throw new Error(
      `Partial modules deploy: failed chains: ${failedNetworks.map((f) => `${f.chainId || '?'}: ${f.error}`).join('; ')}`
    );
  }
  
  // Логируем результаты деплоя для каждой сети
  deployResults.forEach((result, index) => {
    if (result.modules) {
      logger.info(`[MODULES_DBG] ✅ Network ${index + 1} (chainId: ${result.chainId}) SUCCESS`);
      Object.entries(result.modules).forEach(([moduleType, moduleResult]) => {
        if (moduleResult.success) {
          logger.info(`[MODULES_DBG]   ✅ ${moduleType}: ${moduleResult.address}`);
        } else {
          logger.info(`[MODULES_DBG]   ❌ ${moduleType}: ${moduleResult.error}`);
        }
      });
    } else {
      logger.info(`[MODULES_DBG] ❌ Network ${index + 1} (chainId: ${result.chainId}) FAILED: ${result.error}`);
    }
  });

  // Проверяем, что все адреса модулей одинаковые в каждой сети
  for (const moduleType of modulesToDeploy) {
    const addresses = deployResults
      .filter(r => r.modules && r.modules[moduleType] && r.modules[moduleType].success)
      .map(r => r.modules[moduleType].address);
    const uniqueAddresses = [...new Set(addresses)];
    
    logger.info(`[MODULES_DBG] ${moduleType} addresses:`, addresses);
    logger.info(`[MODULES_DBG] ${moduleType} unique addresses:`, uniqueAddresses);
    
    if (uniqueAddresses.length > 1) {
      logger.error(`[MODULES_DBG] ERROR: ${moduleType} addresses are different across networks!`);
      logger.error(`[MODULES_DBG] addresses:`, uniqueAddresses);
      throw new Error(`Nonce alignment failed for ${moduleType} - addresses are different`);
    }
    
    if (uniqueAddresses.length === 0) {
      logger.error(`[MODULES_DBG] ERROR: No successful ${moduleType} deployments!`);
      throw new Error(`No successful ${moduleType} deployments`);
    }

    const chainCount = deployResults.length;
    if (addresses.length !== chainCount) {
      throw new Error(
        `Partial multichain ${moduleType}: ${addresses.length}/${chainCount} chains. Нельзя закрывать деплой одной сетью.`
      );
    }
    
    logger.info(`[MODULES_DBG] SUCCESS: All ${moduleType} addresses are identical:`, uniqueAddresses[0]);
  }

  const etherscanKeyForVerify =
    etherscanKey ||
    params.etherscanApiKey ||
    params.etherscan_api_key ||
    process.env.ETHERSCAN_API_KEY ||
    process.env.ETHERSCAN_V2_API_KEY ||
    '';
  if (etherscanKeyForVerify) {
    logger.info('[MODULES_DBG] Верификация после CREATE во всех сетях (ждём индексацию explorer)');
    for (const deployResult of deployResults) {
      const chainId = Number(deployResult.chainId);
      for (const moduleType of modulesToDeploy) {
        const moduleResult = deployResult.modules?.[moduleType];
        if (!(moduleResult && moduleResult.success && moduleResult.address)) continue;
        const verificationResult = await verifyModuleAfterDeploy(
          chainId,
          moduleResult.address,
          moduleType,
          null,
          etherscanKeyForVerify,
          { ...params, rpcUrl: deployResult.rpcUrl },
          moduleInits[moduleType]
        );
        if (verificationResult.success) {
          moduleResult.verification = 'verified';
          logger.info(`[MODULES_DBG] ${moduleType} chainId=${chainId} verified: ${moduleResult.address}`);
        } else {
          moduleResult.verification = 'failed';
          moduleResult.verificationError = verificationResult.error || verificationResult.message;
          logger.warn(
            `[MODULES_DBG] ${moduleType} chainId=${chainId} verify failed: ${moduleResult.verificationError}`
          );
        }
      }
    }
  } else {
    logger.info('[MODULES_DBG] API ключ Etherscan не предоставлен, верификацию пропускаем');
  }
  
  // Объединяем результаты
  const finalResults = deployResults.map((deployResult, index) => ({
    ...deployResult,
    modules: deployResult.modules ? Object.keys(deployResult.modules).reduce((acc, moduleType) => {
      acc[moduleType] = {
        ...deployResult.modules[moduleType]
      };
      return acc;
    }, {}) : {}
  }));
  
  logger.info('MODULES_DEPLOY_RESULT', JSON.stringify(finalResults));
  
  // Сохраняем результаты в отдельные файлы для каждого модуля
  const dleDir = path.join(__dirname, '../contracts-data/modules');
  if (!fs.existsSync(dleDir)) {
    fs.mkdirSync(dleDir, { recursive: true });
  }
  
  // Создаем файл для каждого модуля
  for (const moduleType of modulesToDeploy) {
    const moduleInfo = {
      moduleType: moduleType,
      dleAddress: dleAddress,
      networks: [],
      deployTimestamp: new Date().toISOString(),
      // Добавляем полные данные из основного DLE контракта
      dleName: params.name,
      dleSymbol: params.symbol,
      dleLocation: params.location,
      dleJurisdiction: params.jurisdiction,
      dleCoordinates: params.coordinates,
      dleOkvedCodes: params.okvedCodes || [],
      dleKpp: params.kpp,
      dleQuorumPercentage: params.quorumPercentage,
      dleLogoURI: params.logoURI,
      dleSupportedChainIds: params.supportedChainIds || [],
      dleInitialPartners: params.initialPartners || [],
      dleInitialAmounts: params.initialAmounts || []
    };
    
    // Собираем информацию о всех сетях для этого модуля
    for (let i = 0; i < deployResults.length; i++) {
      const deployResult = deployResults[i];
      const rpcUrl = deployResult.rpcUrl;
      const moduleResult = deployResult.modules?.[moduleType];

      // Верификационный статус уже хранится в deployResult.modules[moduleType].verification
      const verification = moduleResult?.verification || 'unknown';

      moduleInfo.networks.push({
        chainId: deployResult.chainId ?? null,
        rpcUrl: rpcUrl,
        address: moduleResult?.success ? moduleResult.address : null,
        bridgeAddress: moduleResult?.bridgeAddress || null,
        bridgeWired: moduleResult?.bridgeWired || false,
        bridgeError: moduleResult?.bridgeError || null,
        verification: verification,
        success: moduleResult?.success || false,
        error: moduleResult?.error || null
      });
    }
    
    // Сохраняем файл модуля
    const fileName = `${moduleType}-${dleAddress.toLowerCase()}.json`;
    const filePath = path.join(dleDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(moduleInfo, null, 2));
    logger.info(`[MODULES_DBG] ${moduleType} info saved to: ${filePath}`);
  }
  
  logger.info('[MODULES_DBG] All modules deployment completed!');
  logger.info(`[MODULES_DBG] Available modules: ${Object.keys(MODULE_CONFIGS).join(', ')}`);
  logger.info(`[MODULES_DBG] DLE Address: ${dleAddress}`);
  logger.info(`[MODULES_DBG] DLE Name: ${params.name}`);
  logger.info(`[MODULES_DBG] DLE Symbol: ${params.symbol}`);
  logger.info(`[MODULES_DBG] DLE Location: ${params.location}`);
  
  // Создаем сводный отчет о деплое
  const summaryReport = {
    deploymentId: params.deploymentId || 'modules-deploy-' + Date.now(),
    dleAddress: dleAddress,
    dleName: params.name,
    dleSymbol: params.symbol,
    dleLocation: params.location,
    dleJurisdiction: params.jurisdiction,
    dleCoordinates: params.coordinates,
    dleOkvedCodes: params.okvedCodes || [],
    dleKpp: params.kpp,
    dleQuorumPercentage: params.quorumPercentage,
    dleLogoURI: params.logoURI,
    dleSupportedChainIds: params.supportedChainIds || [],
    totalNetworks: networks.length,
    successfulNetworks: finalResults.filter(r => r.modules && Object.values(r.modules).some(m => m.success)).length,
    modulesDeployed: modulesToDeploy,
    networks: finalResults.map(result => ({
      chainId: result.chainId,
      rpcUrl: result.rpcUrl,
      modules: result.modules ? Object.entries(result.modules).map(([type, module]) => ({
        type: type,
        address: module.address,
        bridgeAddress: module.bridgeAddress || null,
        bridgeWired: module.bridgeWired || false,
        success: module.success,
        verification: module.verification,
        error: module.error
      })) : []
    })),
    timestamp: new Date().toISOString()
  };
  
  // Сохраняем сводный отчет
  const summaryPath = path.join(__dirname, '../contracts-data/modules-deploy-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
  logger.info(`[MODULES_DBG] Сводный отчет сохранен: ${summaryPath}`);
  
  // Уведомляем WebSocket клиентов о завершении деплоя
  logger.info(`[MODULES_DBG] finalResults:`, JSON.stringify(finalResults, null, 2));
  
  const successfulModules = finalResults.reduce((acc, result) => {
    if (result.modules) {
      Object.entries(result.modules).forEach(([type, module]) => {
        if (module.success && module.address) {
          acc[type] = module.address;
        }
      });
    }
    return acc;
  }, {});
  
  const successCount = Object.keys(successfulModules).length;
  const totalCount = modulesToDeploy.length;
  
  logger.info(`[MODULES_DBG] successfulModules:`, successfulModules);
  logger.info(`[MODULES_DBG] successCount: ${successCount}, totalCount: ${totalCount}`);
  
  if (successCount === totalCount) {
    logger.info(`[MODULES_DBG] Деплой завершен успешно! Задеплоено ${successCount} из ${totalCount} модулей`);
  } else {
    throw new Error(`Деплой модулей неполный: ${successCount}/${totalCount}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => { 
  logger.error('❌ Критическая ошибка в main():', e.message);
  logger.error('❌ Stack trace:', e.stack);
  logger.error('❌ Error details:', e);
  process.exit(1); 
});
