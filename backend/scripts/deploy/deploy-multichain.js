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
const { getRpcUrlByChainId } = require('../../services/rpcProviderService');

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

async function deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetDLENonce, dleInit, params) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();

  // DEBUG: базовая информация по сети
  try {
    const calcInitHash = ethers.keccak256(dleInit);
    const saltLen = ethers.getBytes(salt).length;
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} rpc=${rpcUrl}`);
    console.log(`[MULTI_DBG] wallet=${wallet.address} targetDLENonce=${targetDLENonce}`);
    console.log(`[MULTI_DBG] saltLenBytes=${saltLen} salt=${salt}`);
    console.log(`[MULTI_DBG] initCodeHash(provided)=${initCodeHash}`);
    console.log(`[MULTI_DBG] initCodeHash(calculated)=${calcInitHash}`);
    console.log(`[MULTI_DBG] dleInit.lenBytes=${ethers.getBytes(dleInit).length} head16=${dleInit.slice(0, 34)}...`);
  } catch (e) {
    console.log('[MULTI_DBG] precheck error', e?.message || e);
  }

  // 1) Выравнивание nonce до targetDLENonce нулевыми транзакциями (если нужно)
  let current = await provider.getTransactionCount(wallet.address, 'pending');
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} current nonce=${current} target=${targetDLENonce}`);
  
  if (current > targetDLENonce) {
    throw new Error(`Current nonce ${current} > targetDLENonce ${targetDLENonce} on chainId=${Number(net.chainId)}`);
  }
  
  if (current < targetDLENonce) {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} starting nonce alignment: ${current} -> ${targetDLENonce} (${targetDLENonce - current} transactions needed)`);
  } else {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce already aligned: ${current} = ${targetDLENonce}`);
  }
  
  if (current < targetDLENonce) {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} aligning nonce from ${current} to ${targetDLENonce} (${targetDLENonce - current} transactions needed)`);
    
    // Используем burn address для более надежных транзакций
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    
    while (current < targetDLENonce) {
      const overrides = await getFeeOverrides(provider);
      let gasLimit = 21000; // минимальный gas для обычной транзакции
      let sent = false;
      let lastErr = null;
      
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        try {
          const txReq = {
            to: burnAddress, // отправляем на burn address вместо своего адреса
            value: 0n,
            nonce: current,
            gasLimit,
            ...overrides
          };
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} sending filler tx nonce=${current} attempt=${attempt + 1}`);
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} tx details: to=${burnAddress}, value=0, gasLimit=${gasLimit}`);
          const txFill = await wallet.sendTransaction(txReq);
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx sent, hash=${txFill.hash}, waiting for confirmation...`);
          await txFill.wait();
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} confirmed, hash=${txFill.hash}`);
          sent = true;
        } catch (e) {
          lastErr = e;
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} filler tx nonce=${current} attempt=${attempt + 1} failed: ${e?.message || e}`);
          
          if (String(e?.message || '').toLowerCase().includes('intrinsic gas too low') && attempt < 2) {
            gasLimit = 50000; // увеличиваем gas limit
            continue;
          }
          
          if (String(e?.message || '').toLowerCase().includes('nonce too low') && attempt < 2) {
            // Обновляем nonce и пробуем снова
            current = await provider.getTransactionCount(wallet.address, 'pending');
            console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} updated nonce to ${current}`);
            continue;
          }
          
          throw e;
        }
      }
      
      if (!sent) {
        console.error(`[MULTI_DBG] chainId=${Number(net.chainId)} failed to send filler tx for nonce=${current}`);
        throw lastErr || new Error('filler tx failed');
      }
      
      current++;
    }
    
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce alignment completed, current nonce=${current}`);
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} ready for DLE deployment with nonce=${current}`);
  } else {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce already aligned at ${current}`);
  }

  // 2) Деплой DLE напрямую на согласованном nonce
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} deploying DLE directly with nonce=${targetDLENonce}`);
  
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
    
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} estGas=${est?.toString?.()||'null'} effGasPrice=${effPrice?.toString?.()||'0'} maxByBalance=${maxByBalance.toString()} chosenGasLimit=${gasLimit.toString()}`);
  } catch (_) {
    gasLimit = 3_000_000n;
  }

  // Вычисляем предсказанный адрес DLE
  const predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: targetDLENonce
  });
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} predicted DLE address=${predictedAddress}`);

  // Проверяем, не развернут ли уже контракт
  const existingCode = await provider.getCode(predictedAddress);
  if (existingCode && existingCode !== '0x') {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE already exists at predictedAddress, skip deploy`);
    
    // Проверяем и инициализируем логотип для существующего контракта
    if (params.logoURI && params.logoURI !== '') {
      try {
        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} checking logoURI for existing contract`);
        const DLE = await hre.ethers.getContractFactory('DLE');
        const dleContract = DLE.attach(predictedAddress);
        
        const currentLogo = await dleContract.logoURI();
        if (currentLogo === '' || currentLogo === '0x') {
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing logoURI for existing contract: ${params.logoURI}`);
          const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
          await logoTx.wait();
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialized for existing contract`);
        } else {
          console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI already set: ${currentLogo}`);
        }
      } catch (error) {
        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialization failed for existing contract: ${error.message}`);
      }
    }
    
    return { address: predictedAddress, chainId: Number(net.chainId) };
  }

  // Деплоим DLE
  let tx;
  try {
    tx = await wallet.sendTransaction({
      data: dleInit,
      nonce: targetDLENonce,
      gasLimit,
      ...feeOverrides
    });
  } catch (e) {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} deploy error(first): ${e?.message || e}`);
    // Повторная попытка с обновленным nonce
    const updatedNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} retry deploy with nonce=${updatedNonce}`);
    tx = await wallet.sendTransaction({
      data: dleInit,
      nonce: updatedNonce,
      gasLimit,
      ...feeOverrides
    });
  }

  const rc = await tx.wait();
  const deployedAddress = rc.contractAddress || predictedAddress;
  
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE deployed at=${deployedAddress}`);
  
  // Инициализация логотипа если он указан
  if (params.logoURI && params.logoURI !== '') {
    try {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing logoURI: ${params.logoURI}`);
      const DLE = await hre.ethers.getContractFactory('DLE');
      const dleContract = DLE.attach(deployedAddress);
      
      const logoTx = await dleContract.connect(wallet).initializeLogoURI(params.logoURI, feeOverrides);
      await logoTx.wait();
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialized successfully`);
    } catch (error) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialization failed: ${error.message}`);
      // Не прерываем деплой из-за ошибки логотипа
    }
  } else {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} no logoURI specified, skipping initialization`);
  }
  
  return { address: deployedAddress, chainId: Number(net.chainId) };
}


async function main() {
  const { ethers } = hre;
  
  // Загружаем параметры из базы данных или файла
  let params;
  
  try {
    // Пытаемся загрузить из базы данных
    const DeployParamsService = require('../../services/deployParamsService');
    const deployParamsService = new DeployParamsService();
    
    // Проверяем, передан ли конкретный deploymentId
    const deploymentId = process.env.DEPLOYMENT_ID;
    if (deploymentId) {
      console.log(`🔍 Ищем параметры для deploymentId: ${deploymentId}`);
      params = await deployParamsService.getDeployParams(deploymentId);
      if (params) {
        console.log('✅ Параметры загружены из базы данных по deploymentId');
      } else {
        throw new Error(`Параметры деплоя не найдены для deploymentId: ${deploymentId}`);
      }
    } else {
      // Получаем последние параметры деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        params = latestParams[0];
        console.log('✅ Параметры загружены из базы данных (последние)');
      } else {
        throw new Error('Параметры деплоя не найдены в базе данных');
      }
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
  console.log('[MULTI_DBG] Загружены параметры:', {
    name: params.name,
    symbol: params.symbol,
    supportedChainIds: params.supportedChainIds,
    CREATE2_SALT: params.CREATE2_SALT
  });

  const pk = params.private_key || process.env.PRIVATE_KEY;
  const salt = params.CREATE2_SALT || params.create2_salt;
  const networks = params.rpcUrls || params.rpc_urls || [];
  
  if (!pk) throw new Error('Env: PRIVATE_KEY');
  if (!salt) throw new Error('CREATE2_SALT not found in params');
  if (networks.length === 0) throw new Error('RPC URLs not found in params');

  // Prepare init code once
  const DLE = await hre.ethers.getContractFactory('contracts/DLE.sol:DLE');
  const dleConfig = {
    name: params.name || '',
    symbol: params.symbol || '',
    location: params.location || '',
    coordinates: params.coordinates || '',
    jurisdiction: params.jurisdiction || 0,
    oktmo: params.oktmo || '',
    okvedCodes: params.okvedCodes || [],
    kpp: params.kpp ? BigInt(params.kpp) : 0n,
    quorumPercentage: params.quorumPercentage || 51,
    initialPartners: params.initialPartners || [],
    initialAmounts: (params.initialAmounts || []).map(amount => BigInt(amount) * BigInt(10**18)),
    supportedChainIds: (params.supportedChainIds || []).map(id => BigInt(id))
  };
  const deployTx = await DLE.getDeployTransaction(dleConfig, BigInt(params.currentChainId || params.supportedChainIds?.[0] || 1), params.initializer || params.initialPartners?.[0] || "0x0000000000000000000000000000000000000000");
  const dleInit = deployTx.data;
  const initCodeHash = ethers.keccak256(dleInit);
  
  // DEBUG: глобальные значения
  try {
    const saltLen = ethers.getBytes(salt).length;
    console.log(`[MULTI_DBG] GLOBAL saltLenBytes=${saltLen} salt=${salt}`);
    console.log(`[MULTI_DBG] GLOBAL initCodeHash(calculated)=${initCodeHash}`);
    console.log(`[MULTI_DBG] GLOBAL dleInit.lenBytes=${ethers.getBytes(dleInit).length} head16=${dleInit.slice(0, 34)}...`);
  } catch (e) {
    console.log('[MULTI_DBG] GLOBAL precheck error', e?.message || e);
  }

  // Подготовим провайдеры и вычислим общий nonce для DLE
  const providers = networks.map(u => new hre.ethers.JsonRpcProvider(u));
  const wallets = providers.map(p => new hre.ethers.Wallet(pk, p));
  const nonces = [];
  for (let i = 0; i < providers.length; i++) {
    const n = await providers[i].getTransactionCount(wallets[i].address, 'pending');
    nonces.push(n);
  }
  const targetDLENonce = Math.max(...nonces);
  console.log(`[MULTI_DBG] nonces=${JSON.stringify(nonces)} targetDLENonce=${targetDLENonce}`);
  console.log(`[MULTI_DBG] Starting deployment to ${networks.length} networks:`, networks);

  // ПАРАЛЛЕЛЬНЫЙ деплой во всех сетях одновременно
  console.log(`[MULTI_DBG] Starting PARALLEL deployment to ${networks.length} networks`);
  
  const deploymentPromises = networks.map(async (rpcUrl, i) => {
    console.log(`[MULTI_DBG] 🚀 Starting deployment to network ${i + 1}/${networks.length}: ${rpcUrl}`);
    
    try {
      // Получаем chainId динамически из сети
      const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      
      console.log(`[MULTI_DBG] 📡 Network ${i + 1} chainId: ${chainId}`);
      
      const r = await deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetDLENonce, dleInit, params);
      console.log(`[MULTI_DBG] ✅ Network ${i + 1} (chainId: ${chainId}) deployment SUCCESS: ${r.address}`);
      return { rpcUrl, chainId, ...r };
    } catch (error) {
      console.error(`[MULTI_DBG] ❌ Network ${i + 1} deployment FAILED:`, error.message);
      return { rpcUrl, error: error.message };
    }
  });
  
  // Ждем завершения всех деплоев
  const results = await Promise.all(deploymentPromises);
  console.log(`[MULTI_DBG] All ${networks.length} deployments completed`);
  
  // Логируем результаты для каждой сети
  results.forEach((result, index) => {
    if (result.address) {
      console.log(`[MULTI_DBG] ✅ Network ${index + 1} (chainId: ${result.chainId}) SUCCESS: ${result.address}`);
    } else {
      console.log(`[MULTI_DBG] ❌ Network ${index + 1} (chainId: ${result.chainId}) FAILED: ${result.error}`);
    }
  });
  
  // Проверяем, что все адреса одинаковые
  const addresses = results.map(r => r.address).filter(addr => addr);
  const uniqueAddresses = [...new Set(addresses)];
  
  console.log('[MULTI_DBG] All addresses:', addresses);
  console.log('[MULTI_DBG] Unique addresses:', uniqueAddresses);
  console.log('[MULTI_DBG] Results count:', results.length);
  console.log('[MULTI_DBG] Networks count:', networks.length);
  
  if (uniqueAddresses.length > 1) {
    console.error('[MULTI_DBG] ERROR: DLE addresses are different across networks!');
    console.error('[MULTI_DBG] addresses:', uniqueAddresses);
    throw new Error('Nonce alignment failed - addresses are different');
  }
  
  if (uniqueAddresses.length === 0) {
    console.error('[MULTI_DBG] ERROR: No successful deployments!');
    throw new Error('No successful deployments');
  }
  
  console.log('[MULTI_DBG] SUCCESS: All DLE addresses are identical:', uniqueAddresses[0]);
  
  // Автоматическая верификация контрактов
  let verificationResults = [];
  
  console.log(`[MULTI_DBG] autoVerifyAfterDeploy: ${params.autoVerifyAfterDeploy}`);
  
  if (params.autoVerifyAfterDeploy) {
    console.log('[MULTI_DBG] Starting automatic contract verification...');
    
    try {
      // Импортируем функцию верификации
      const { verifyWithHardhatV2 } = require('../verify-with-hardhat-v2');
      
      // Подготавливаем данные о развернутых сетях
      const deployedNetworks = results
        .filter(result => result.address && !result.error)
        .map(result => ({
          chainId: result.chainId,
          address: result.address
        }));
      
      // Запускаем верификацию с данными о сетях
      await verifyWithHardhatV2(params, deployedNetworks);
      
      // Если верификация прошла успешно, отмечаем все как верифицированные
      verificationResults = networks.map(() => 'verified');
      console.log('[MULTI_DBG] ✅ Automatic verification completed successfully');
      
    } catch (verificationError) {
      console.error('[MULTI_DBG] ❌ Automatic verification failed:', verificationError.message);
      verificationResults = networks.map(() => 'verification_failed');
    }
  } else {
    console.log('[MULTI_DBG] Contract verification disabled (autoVerifyAfterDeploy: false)');
    verificationResults = networks.map(() => 'disabled');
  }
  
  // Объединяем результаты
  const finalResults = results.map((result, index) => ({
    ...result,
    verification: verificationResults[index] || 'failed'
  }));
  
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify(finalResults));
  
  console.log('[MULTI_DBG] DLE deployment completed successfully!');
}

main().catch((e) => { console.error(e); process.exit(1); });


