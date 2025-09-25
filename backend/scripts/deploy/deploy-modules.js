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
const hre = require('hardhat');
const path = require('path');
const fs = require('fs');

// Подбираем безопасные gas/fee для разных сетей (включая L2)
async function getFeeOverrides(provider, { minPriorityGwei = 1n, minFeeGwei = 20n } = {}) {
  const fee = await provider.getFeeData();
  const overrides = {};
  const minPriority = (await (async () => hre.ethers.parseUnits(minPriorityGwei.toString(), 'gwei'))());
  const minFee = (await (async () => hre.ethers.parseUnits(minFeeGwei.toString(), 'gwei'))());
  if (fee.maxFeePerGas) {
    overrides.maxFeePerGas = fee.maxFeePerGas < minFee ? minFee : fee.maxFeePerGas;
    overrides.maxPriorityFeePerGas = (fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas > 0n)
      ? fee.maxPriorityFeePerGas
      : minPriority;
  } else if (fee.gasPrice) {
    overrides.gasPrice = fee.gasPrice < minFee ? minFee : fee.gasPrice;
  }
  return overrides;
}

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
    constructorArgs: (dleAddress) => [
      dleAddress // _dleContract
    ],
    verificationArgs: (dleAddress) => [
      dleAddress // _dleContract
    ]
  },
  reader: {
    contractName: 'DLEReader',
    constructorArgs: (dleAddress) => [
      dleAddress // _dleContract
    ],
    verificationArgs: (dleAddress) => [
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

// Деплой модуля в одной сети с CREATE2
async function deployModuleInNetwork(rpcUrl, pk, salt, initCodeHash, targetNonce, moduleInit, moduleType) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();

  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} deploying ${moduleType}...`);
  
  // 1) Выравнивание nonce до targetNonce нулевыми транзакциями (если нужно)
  let current = await provider.getTransactionCount(wallet.address, 'pending');
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} current nonce=${current} target=${targetNonce}`);
  
  if (current > targetNonce) {
    throw new Error(`Current nonce ${current} > targetNonce ${targetNonce} on chainId=${Number(net.chainId)}`);
  }
  
  if (current < targetNonce) {
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} aligning nonce from ${current} to ${targetNonce} (${targetNonce - current} transactions needed)`);
    
    // Используем burn address для более надежных транзакций
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    
    while (current < targetNonce) {
      const overrides = await getFeeOverrides(provider);
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
          console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} sending filler tx nonce=${current} attempt=${attempt + 1}`);
          const txFill = await wallet.sendTransaction(txReq);
          console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} filler tx sent, hash=${txFill.hash}, waiting for confirmation...`);
          await txFill.wait();
          console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} confirmed, hash=${txFill.hash}`);
          sent = true;
        } catch (e) {
          lastErr = e;
          console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} attempt=${attempt + 1} failed: ${e?.message || e}`);
          
          if (String(e?.message || '').toLowerCase().includes('intrinsic gas too low') && attempt < 2) {
            gasLimit = 50000;
            continue;
          }
          
          if (String(e?.message || '').toLowerCase().includes('nonce too low') && attempt < 2) {
            current = await provider.getTransactionCount(wallet.address, 'pending');
            console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} updated nonce to ${current}`);
            continue;
          }
          
          throw e;
        }
      }
      
      if (!sent) {
        console.error(`[MODULES_DBG] chainId=${Number(net.chainId)} failed to send filler tx for nonce=${current}`);
        throw lastErr || new Error('filler tx failed');
      }
      
      current++;
    }
    
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} nonce alignment completed, current nonce=${current}`);
  } else {
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} nonce already aligned at ${current}`);
  }

  // 2) Деплой модуля напрямую на согласованном nonce
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} deploying ${moduleType} directly with nonce=${targetNonce}`);
  
  const feeOverrides = await getFeeOverrides(provider);
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
    
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
  } catch (_) {
    gasLimit = 1_000_000n;
  }

  // Вычисляем предсказанный адрес модуля
  const predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: targetNonce
  });
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} predicted ${moduleType} address=${predictedAddress}`);

  // Проверяем, не развернут ли уже контракт
  const existingCode = await provider.getCode(predictedAddress);
  if (existingCode && existingCode !== '0x') {
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} ${moduleType} already exists at predictedAddress, skip deploy`);
    return { address: predictedAddress, chainId: Number(net.chainId) };
  }

  // Деплоим модуль
  let tx;
  try {
    tx = await wallet.sendTransaction({
      data: moduleInit,
      nonce: targetNonce,
      gasLimit,
      ...feeOverrides
    });
  } catch (e) {
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} deploy error(first): ${e?.message || e}`);
    // Повторная попытка с обновленным nonce
    const updatedNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} retry deploy with nonce=${updatedNonce}`);
    tx = await wallet.sendTransaction({
      data: moduleInit,
      nonce: updatedNonce,
      gasLimit,
      ...feeOverrides
    });
  }

  const rc = await tx.wait();
  const deployedAddress = rc.contractAddress || predictedAddress;
  
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} ${moduleType} deployed at=${deployedAddress}`);
  return { address: deployedAddress, chainId: Number(net.chainId) };
}

// Верификация модуля в одной сети
async function verifyModuleInNetwork(rpcUrl, pk, dleAddress, moduleType, moduleConfig, moduleAddress) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();
  
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} verifying ${moduleConfig.contractName}...`);
  
  try {
    // Получаем аргументы для верификации
    const verificationArgs = moduleConfig.verificationArgs(dleAddress, Number(net.chainId), wallet.address);
    
    await hre.run("verify:verify", {
      address: moduleAddress,
      constructorArguments: verificationArgs,
    });
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} ${moduleConfig.contractName} verification successful`);
    return 'success';
  } catch (error) {
    console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} ${moduleConfig.contractName} verification failed: ${error.message}`);
    return 'failed';
  }
}

// Деплой всех модулей в одной сети
async function deployAllModulesInNetwork(rpcUrl, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();

  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} deploying modules: ${modulesToDeploy.join(', ')}`);
  
  const results = {};
  
  for (let i = 0; i < modulesToDeploy.length; i++) {
    const moduleType = modulesToDeploy[i];
    const moduleInit = moduleInits[moduleType];
    const targetNonce = targetNonces[moduleType];
    
    if (!MODULE_CONFIGS[moduleType]) {
      console.error(`[MODULES_DBG] chainId=${Number(net.chainId)} Unknown module type: ${moduleType}`);
      results[moduleType] = { success: false, error: `Unknown module type: ${moduleType}` };
      continue;
    }
    
    if (!moduleInit) {
      console.error(`[MODULES_DBG] chainId=${Number(net.chainId)} No init code for module: ${moduleType}`);
      results[moduleType] = { success: false, error: `No init code for module: ${moduleType}` };
      continue;
    }
    
    try {
      const result = await deployModuleInNetwork(rpcUrl, pk, salt, null, targetNonce, moduleInit, moduleType);
      results[moduleType] = { ...result, success: true };
    } catch (error) {
      console.error(`[MODULES_DBG] chainId=${Number(net.chainId)} ${moduleType} deployment failed:`, error.message);
      results[moduleType] = { 
        chainId: Number(net.chainId), 
        success: false, 
        error: error.message 
      };
    }
  }
  
  return {
    chainId: Number(net.chainId),
    modules: results
  };
}

// Верификация всех модулей в одной сети
async function verifyAllModulesInNetwork(rpcUrl, pk, dleAddress, moduleResults, modulesToVerify) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();
  
  console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} verifying modules: ${modulesToVerify.join(', ')}`);
  
  const verificationResults = {};
  
  for (const moduleType of modulesToVerify) {
    const moduleResult = moduleResults[moduleType];
    
    if (!moduleResult || !moduleResult.success || !moduleResult.address) {
      console.log(`[MODULES_DBG] chainId=${Number(net.chainId)} skipping verification for ${moduleType} - deployment failed`);
      verificationResults[moduleType] = 'skipped';
      continue;
    }
    
    if (!MODULE_CONFIGS[moduleType]) {
      console.error(`[MODULES_DBG] chainId=${Number(net.chainId)} Unknown module type for verification: ${moduleType}`);
      verificationResults[moduleType] = 'unknown_module';
      continue;
    }
    
    const moduleConfig = MODULE_CONFIGS[moduleType];
    const verification = await verifyModuleInNetwork(rpcUrl, pk, dleAddress, moduleType, moduleConfig, moduleResult.address);
    verificationResults[moduleType] = verification;
  }
  
  return {
    chainId: Number(net.chainId),
    modules: verificationResults
  };
}

// Деплой всех модулей во всех сетях
async function deployAllModulesInAllNetworks(networks, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces) {
  const results = [];
  
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    console.log(`[MODULES_DBG] deploying modules to network ${i + 1}/${networks.length}: ${rpcUrl}`);
    
    const result = await deployAllModulesInNetwork(rpcUrl, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces);
    results.push(result);
  }
  
  return results;
}

// Верификация всех модулей во всех сетях
async function verifyAllModulesInAllNetworks(networks, pk, dleAddress, deployResults, modulesToVerify) {
  const verificationResults = [];
  
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    const deployResult = deployResults[i];
    
    console.log(`[MODULES_DBG] verifying modules in network ${i + 1}/${networks.length}: ${rpcUrl}`);
    
    const verification = await verifyAllModulesInNetwork(rpcUrl, pk, dleAddress, deployResult.modules, modulesToVerify);
    verificationResults.push(verification);
  }
  
  return verificationResults;
}

async function main() {
  const { ethers } = hre;
  
  // Загружаем параметры из базы данных или файла
  let params;
  
  try {
    // Пытаемся загрузить из базы данных
    const DeployParamsService = require('../../services/deployParamsService');
    const deployParamsService = new DeployParamsService();
    
    // Получаем последние параметры деплоя
    const latestParams = await deployParamsService.getLatestDeployParams(1);
    if (latestParams.length > 0) {
      params = latestParams[0];
      console.log('✅ Параметры загружены из базы данных');
    } else {
      throw new Error('Параметры деплоя не найдены в базе данных');
    }
    
    await deployParamsService.close();
  } catch (dbError) {
    console.log('⚠️ Не удалось загрузить параметры из БД, пытаемся загрузить из файла:', dbError.message);
    
    // Fallback к файлу
    const paramsPath = path.join(__dirname, './current-params.json');
    if (!fs.existsSync(paramsPath)) {
      throw new Error('Файл параметров не найден: ' + paramsPath);
    }
    
    params = JSON.parse(fs.readFileSync(paramsPath, 'utf8'));
    console.log('✅ Параметры загружены из файла');
  }
  console.log('[MODULES_DBG] Загружены параметры:', {
    name: params.name,
    symbol: params.symbol,
    supportedChainIds: params.supportedChainIds,
    CREATE2_SALT: params.CREATE2_SALT
  });

  const pk = process.env.PRIVATE_KEY;
  const networks = params.rpcUrls || params.rpc_urls || [];
  const dleAddress = params.dleAddress;
  const salt = params.CREATE2_SALT || params.create2_salt;
  
  // Модули для деплоя (можно настроить через параметры)
  const modulesToDeploy = params.modulesToDeploy || ['treasury', 'timelock', 'reader'];
  
  if (!pk) throw new Error('Env: PRIVATE_KEY');
  if (!dleAddress) throw new Error('DLE_ADDRESS not found in params');
  if (!salt) throw new Error('CREATE2_SALT not found in params');
  if (networks.length === 0) throw new Error('RPC URLs not found in params');

  console.log(`[MODULES_DBG] Starting modules deployment to ${networks.length} networks`);
  console.log(`[MODULES_DBG] DLE Address: ${dleAddress}`);
  console.log(`[MODULES_DBG] Modules to deploy: ${modulesToDeploy.join(', ')}`);
  console.log(`[MODULES_DBG] Networks:`, networks);

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
    const firstProvider = new hre.ethers.JsonRpcProvider(networks[0]);
    const firstWallet = new hre.ethers.Wallet(pk, firstProvider);
    const firstNetwork = await firstProvider.getNetwork();
    const constructorArgs = moduleConfig.constructorArgs(dleAddress, Number(firstNetwork.chainId), firstWallet.address);
    
    const deployTx = await ContractFactory.getDeployTransaction(...constructorArgs);
    moduleInits[moduleType] = deployTx.data;
    moduleInitCodeHashes[moduleType] = ethers.keccak256(deployTx.data);
    
    console.log(`[MODULES_DBG] ${moduleType} init code prepared, hash: ${moduleInitCodeHashes[moduleType]}`);
  }

  // Подготовим провайдеры и вычислим общие nonce для каждого модуля
  const providers = networks.map(u => new hre.ethers.JsonRpcProvider(u));
  const wallets = providers.map(p => new hre.ethers.Wallet(pk, p));
  const nonces = [];
  for (let i = 0; i < providers.length; i++) {
    const n = await providers[i].getTransactionCount(wallets[i].address, 'pending');
    nonces.push(n);
  }
  
  // Вычисляем target nonce для каждого модуля
  const targetNonces = {};
  let currentMaxNonce = Math.max(...nonces);
  
  for (const moduleType of modulesToDeploy) {
    targetNonces[moduleType] = currentMaxNonce;
    currentMaxNonce++; // каждый следующий модуль получает nonce +1
  }
  
  console.log(`[MODULES_DBG] nonces=${JSON.stringify(nonces)} targetNonces=${JSON.stringify(targetNonces)}`);

  // ПАРАЛЛЕЛЬНЫЙ деплой всех модулей во всех сетях одновременно
  console.log(`[MODULES_DBG] Starting PARALLEL deployment of all modules to ${networks.length} networks`);
  
  const deploymentPromises = networks.map(async (rpcUrl, networkIndex) => {
    console.log(`[MODULES_DBG] 🚀 Starting deployment to network ${networkIndex + 1}/${networks.length}: ${rpcUrl}`);
    
    try {
      // Получаем chainId динамически из сети
      const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log(`[MODULES_DBG] 📡 Network ${networkIndex + 1} chainId: ${chainId}`);
      
      const result = await deployAllModulesInNetwork(rpcUrl, pk, salt, dleAddress, modulesToDeploy, moduleInits, targetNonces);
      console.log(`[MODULES_DBG] ✅ Network ${networkIndex + 1} (chainId: ${chainId}) deployment SUCCESS`);
      return { rpcUrl, chainId, ...result };
    } catch (error) {
      console.error(`[MODULES_DBG] ❌ Network ${networkIndex + 1} deployment FAILED:`, error.message);
      return { rpcUrl, error: error.message };
    }
  });
  
  // Ждем завершения всех деплоев
  const deployResults = await Promise.all(deploymentPromises);
  console.log(`[MODULES_DBG] All ${networks.length} deployments completed`);
  
  // Логируем результаты деплоя для каждой сети
  deployResults.forEach((result, index) => {
    if (result.modules) {
      console.log(`[MODULES_DBG] ✅ Network ${index + 1} (chainId: ${result.chainId}) SUCCESS`);
      Object.entries(result.modules).forEach(([moduleType, moduleResult]) => {
        if (moduleResult.success) {
          console.log(`[MODULES_DBG]   ✅ ${moduleType}: ${moduleResult.address}`);
        } else {
          console.log(`[MODULES_DBG]   ❌ ${moduleType}: ${moduleResult.error}`);
        }
      });
    } else {
      console.log(`[MODULES_DBG] ❌ Network ${index + 1} (chainId: ${result.chainId}) FAILED: ${result.error}`);
    }
  });

  // Проверяем, что все адреса модулей одинаковые в каждой сети
  for (const moduleType of modulesToDeploy) {
    const addresses = deployResults
      .filter(r => r.modules && r.modules[moduleType] && r.modules[moduleType].success)
      .map(r => r.modules[moduleType].address);
    const uniqueAddresses = [...new Set(addresses)];
    
    console.log(`[MODULES_DBG] ${moduleType} addresses:`, addresses);
    console.log(`[MODULES_DBG] ${moduleType} unique addresses:`, uniqueAddresses);
    
    if (uniqueAddresses.length > 1) {
      console.error(`[MODULES_DBG] ERROR: ${moduleType} addresses are different across networks!`);
      console.error(`[MODULES_DBG] addresses:`, uniqueAddresses);
      throw new Error(`Nonce alignment failed for ${moduleType} - addresses are different`);
    }
    
    if (uniqueAddresses.length === 0) {
      console.error(`[MODULES_DBG] ERROR: No successful ${moduleType} deployments!`);
      throw new Error(`No successful ${moduleType} deployments`);
    }
    
    console.log(`[MODULES_DBG] SUCCESS: All ${moduleType} addresses are identical:`, uniqueAddresses[0]);
  }

  // Верификация во всех сетях
  console.log(`[MODULES_DBG] Starting verification in all networks...`);
  const verificationResults = await verifyAllModulesInAllNetworks(networks, pk, dleAddress, deployResults, modulesToDeploy);
  
  // Объединяем результаты
  const finalResults = deployResults.map((deployResult, index) => ({
    ...deployResult,
    modules: deployResult.modules ? Object.keys(deployResult.modules).reduce((acc, moduleType) => {
      acc[moduleType] = {
        ...deployResult.modules[moduleType],
        verification: verificationResults[index]?.modules?.[moduleType] || 'unknown'
      };
      return acc;
    }, {}) : {}
  }));
  
  console.log('MODULES_DEPLOY_RESULT', JSON.stringify(finalResults));
  
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
      // Добавляем данные из основного DLE контракта
      dleName: params.name,
      dleSymbol: params.symbol,
      dleLocation: params.location,
      dleJurisdiction: params.jurisdiction
    };
    
    // Собираем информацию о всех сетях для этого модуля
    for (let i = 0; i < networks.length; i++) {
      const rpcUrl = networks[i];
      const deployResult = deployResults[i];
      const verificationResult = verificationResults[i];
      const moduleResult = deployResult.modules?.[moduleType];
      const verification = verificationResult?.modules?.[moduleType] || 'unknown';
      
      try {
        const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
        const network = await provider.getNetwork();
        
        moduleInfo.networks.push({
          chainId: Number(network.chainId),
          rpcUrl: rpcUrl,
          address: moduleResult?.success ? moduleResult.address : null,
          verification: verification,
          success: moduleResult?.success || false,
          error: moduleResult?.error || null
        });
      } catch (error) {
        console.error(`[MODULES_DBG] Ошибка получения chainId для модуля ${moduleType} в сети ${i + 1}:`, error.message);
        moduleInfo.networks.push({
          chainId: null,
          rpcUrl: rpcUrl,
          address: null,
          verification: 'error',
          success: false,
          error: error.message
        });
      }
    }
    
    // Сохраняем файл модуля
    const fileName = `${moduleType}-${dleAddress.toLowerCase()}.json`;
    const filePath = path.join(dleDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(moduleInfo, null, 2));
    console.log(`[MODULES_DBG] ${moduleType} info saved to: ${filePath}`);
  }
  
  console.log('[MODULES_DBG] All modules deployment completed!');
  console.log(`[MODULES_DBG] Available modules: ${Object.keys(MODULE_CONFIGS).join(', ')}`);
  console.log(`[MODULES_DBG] DLE Address: ${dleAddress}`);
  console.log(`[MODULES_DBG] DLE Name: ${params.name}`);
  console.log(`[MODULES_DBG] DLE Symbol: ${params.symbol}`);
  console.log(`[MODULES_DBG] DLE Location: ${params.location}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
