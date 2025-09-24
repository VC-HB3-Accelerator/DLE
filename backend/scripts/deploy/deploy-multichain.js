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

async function deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetDLENonce, dleInit) {
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
  return { address: deployedAddress, chainId: Number(net.chainId) };
}

// Деплой модулей в одной сети
async function deployModulesInNetwork(rpcUrl, pk, dleAddress, params) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();
  
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} deploying modules...`);
  
  const modules = {};
  
  // Получаем начальный nonce для всех модулей
  let currentNonce = await wallet.getNonce();
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} starting nonce for modules: ${currentNonce}`);
  
  // Функция для безопасного деплоя с правильным nonce
  async function deployWithNonce(contractFactory, args, moduleName) {
    try {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} deploying ${moduleName} with nonce: ${currentNonce}`);
      
      // Проверяем, что nonce актуален
      const actualNonce = await wallet.getNonce();
      if (actualNonce > currentNonce) {
        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce mismatch, updating from ${currentNonce} to ${actualNonce}`);
        currentNonce = actualNonce;
      }
      
      const contract = await contractFactory.connect(wallet).deploy(...args);
      await contract.waitForDeployment();
      const address = await contract.getAddress();
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} ${moduleName} deployed at: ${address}`);
      currentNonce++;
      return address;
    } catch (error) {
      console.error(`[MULTI_DBG] chainId=${Number(net.chainId)} ${moduleName} deployment failed:`, error.message);
      // Даже при ошибке увеличиваем nonce, чтобы не было конфликтов
      currentNonce++;
      return null;
    }
  }
  
  // Деплой TreasuryModule
  const TreasuryModule = await hre.ethers.getContractFactory('TreasuryModule');
  modules.treasuryModule = await deployWithNonce(
    TreasuryModule,
    [dleAddress, Number(net.chainId), wallet.address], // _dleContract, _chainId, _emergencyAdmin
    'TreasuryModule'
  );
                    
  // Деплой TimelockModule
  const TimelockModule = await hre.ethers.getContractFactory('TimelockModule');
  modules.timelockModule = await deployWithNonce(
    TimelockModule,
    [dleAddress], // _dleContract
    'TimelockModule'
  );
  
  // Деплой DLEReader
  const DLEReader = await hre.ethers.getContractFactory('DLEReader');
  modules.dleReader = await deployWithNonce(
    DLEReader,
    [dleAddress], // _dleContract
    'DLEReader'
  );
  
  // Инициализация модулей в DLE
  try {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing modules in DLE with nonce: ${currentNonce}`);
    
    // Проверяем, что nonce актуален
    const actualNonce = await wallet.getNonce();
    if (actualNonce > currentNonce) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce mismatch before module init, updating from ${currentNonce} to ${actualNonce}`);
      currentNonce = actualNonce;
    }
    
    const dleContract = await hre.ethers.getContractAt('DLE', dleAddress, wallet);
    
    // Проверяем, что все модули задеплоены
    const treasuryAddress = modules.treasuryModule;
    const timelockAddress = modules.timelockModule;
    const readerAddress = modules.dleReader;
    
    if (treasuryAddress && timelockAddress && readerAddress) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} All modules deployed, initializing...`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Treasury: ${treasuryAddress}`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Timelock: ${timelockAddress}`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Reader: ${readerAddress}`);
      
      // Модули деплоятся отдельно, инициализация через governance
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Modules deployed successfully, initialization will be done through governance proposals`);
    } else {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} skipping module initialization - not all modules deployed`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Treasury: ${treasuryAddress || 'MISSING'}`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Timelock: ${timelockAddress || 'MISSING'}`);
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} Reader: ${readerAddress || 'MISSING'}`);
    }
  } catch (error) {
    console.error(`[MULTI_DBG] chainId=${Number(net.chainId)} module initialization failed:`, error.message);
    // Даже при ошибке увеличиваем nonce
    currentNonce++;
  }
  
  // Инициализация logoURI
  try {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} initializing logoURI with nonce: ${currentNonce}`);
    
    // Проверяем, что nonce актуален
    const actualNonce = await wallet.getNonce();
    if (actualNonce > currentNonce) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} nonce mismatch before logoURI init, updating from ${currentNonce} to ${actualNonce}`);
      currentNonce = actualNonce;
    }
    
    // Используем логотип из параметров деплоя или fallback
    const logoURL = params.logoURI || "https://via.placeholder.com/200x200/0066cc/ffffff?text=DLE";
    const dleContract = await hre.ethers.getContractAt('DLE', dleAddress, wallet);
    await dleContract.initializeLogoURI(logoURL);
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialized: ${logoURL}`);
    currentNonce++;
  } catch (e) {
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} logoURI initialization failed: ${e.message}`);
    // Fallback на базовый логотип
    try {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} trying fallback logoURI with nonce: ${currentNonce}`);
      const dleContract = await hre.ethers.getContractAt('DLE', dleAddress, wallet);
      await dleContract.initializeLogoURI("https://via.placeholder.com/200x200/0066cc/ffffff?text=DLE");
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} fallback logoURI initialized`);
      currentNonce++;
    } catch (fallbackError) {
      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} fallback logoURI also failed: ${fallbackError.message}`);
      // Даже при ошибке увеличиваем nonce
      currentNonce++;
    }
  }
  
  return modules;
}

// Деплой модулей во всех сетях
async function deployModulesInAllNetworks(networks, pk, dleAddress, params) {
  const moduleResults = [];
  
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    console.log(`[MULTI_DBG] deploying modules to network ${i + 1}/${networks.length}: ${rpcUrl}`);
    
    try {
      const modules = await deployModulesInNetwork(rpcUrl, pk, dleAddress, params);
      moduleResults.push(modules);
    } catch (error) {
      console.error(`[MULTI_DBG] Failed to deploy modules in network ${i + 1}:`, error.message);
      moduleResults.push({ error: error.message });
    }
  }
  
  return moduleResults;
}

// Верификация контрактов в одной сети
async function verifyContractsInNetwork(rpcUrl, pk, dleAddress, modules, params) {
  const { ethers } = hre;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const net = await provider.getNetwork();
  
  console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} starting verification...`);
  
  const verification = {};
  
  try {
    // Верификация DLE
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} verifying DLE...`);
    await hre.run("verify:verify", {
      address: dleAddress,
      constructorArguments: [
        {
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
          initialAmounts: (params.initialAmounts || []).map(amount => BigInt(amount)),
          supportedChainIds: (params.supportedChainIds || []).map(id => BigInt(id))
        },
        BigInt(params.currentChainId || params.supportedChainIds?.[0] || 1),
        params.initializer || params.initialPartners?.[0] || "0x0000000000000000000000000000000000000000"
      ],
    });
    verification.dle = 'success';
    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE verification successful`);
                    } catch (error) {
                    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE verification failed: ${error.message}`);
                    console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLE verification error details:`, error);
                    verification.dle = 'failed';
                  }
  
                    // Верификация модулей
                  if (modules && !modules.error) {
                    try {
                      // Верификация TreasuryModule
                      if (modules.treasuryModule) {
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} verifying TreasuryModule...`);
                        await hre.run("verify:verify", {
                          address: modules.treasuryModule,
                          constructorArguments: [
                            dleAddress, // _dleContract
                            Number(net.chainId), // _chainId
                            wallet.address // _emergencyAdmin
                          ],
                        });
                        verification.treasuryModule = 'success';
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} TreasuryModule verification successful`);
                      }
                    } catch (error) {
                      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} TreasuryModule verification failed: ${error.message}`);
                      verification.treasuryModule = 'failed';
                    }
                    
                    try {
                      // Верификация TimelockModule
                      if (modules.timelockModule) {
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} verifying TimelockModule...`);
                        await hre.run("verify:verify", {
                          address: modules.timelockModule,
                          constructorArguments: [
                            dleAddress // _dleContract
                          ],
                        });
                        verification.timelockModule = 'success';
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} TimelockModule verification successful`);
                      }
                    } catch (error) {
                      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} TimelockModule verification failed: ${error.message}`);
                      verification.timelockModule = 'failed';
                    }
                    
                    try {
                      // Верификация DLEReader
                      if (modules.dleReader) {
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} verifying DLEReader...`);
                        await hre.run("verify:verify", {
                          address: modules.dleReader,
                          constructorArguments: [
                            dleAddress // _dleContract
                          ],
                        });
                        verification.dleReader = 'success';
                        console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLEReader verification successful`);
                      }
                    } catch (error) {
                      console.log(`[MULTI_DBG] chainId=${Number(net.chainId)} DLEReader verification failed: ${error.message}`);
                      verification.dleReader = 'failed';
                    }
                  }
  
  return verification;
}

// Верификация контрактов во всех сетях
async function verifyContractsInAllNetworks(networks, pk, dleAddress, moduleResults, params) {
  const verificationResults = [];
  
  for (let i = 0; i < networks.length; i++) {
    const rpcUrl = networks[i];
    console.log(`[MULTI_DBG] verifying contracts in network ${i + 1}/${networks.length}: ${rpcUrl}`);
    
    try {
      const verification = await verifyContractsInNetwork(rpcUrl, pk, dleAddress, moduleResults[i], params);
      verificationResults.push(verification);
    } catch (error) {
      console.error(`[MULTI_DBG] Failed to verify contracts in network ${i + 1}:`, error.message);
      verificationResults.push({ error: error.message });
    }
  }
  
  return verificationResults;
}

async function main() {
  const { ethers } = hre;
  
  // Загружаем параметры из файла
  const paramsPath = path.join(__dirname, './current-params.json');
  if (!fs.existsSync(paramsPath)) {
    throw new Error('Файл параметров не найден: ' + paramsPath);
  }
  
  const params = JSON.parse(fs.readFileSync(paramsPath, 'utf8'));
  console.log('[MULTI_DBG] Загружены параметры:', {
    name: params.name,
    symbol: params.symbol,
    supportedChainIds: params.supportedChainIds,
    CREATE2_SALT: params.CREATE2_SALT
  });

  const pk = process.env.PRIVATE_KEY;
  const salt = params.CREATE2_SALT;
  const networks = params.rpcUrls || [];
  
  if (!pk) throw new Error('Env: PRIVATE_KEY');
  if (!salt) throw new Error('CREATE2_SALT not found in params');
  if (networks.length === 0) throw new Error('RPC URLs not found in params');

  // Prepare init code once
  const DLE = await hre.ethers.getContractFactory('DLE');
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
    initialAmounts: (params.initialAmounts || []).map(amount => BigInt(amount)),
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
      
      const r = await deployInNetwork(rpcUrl, pk, salt, initCodeHash, targetDLENonce, dleInit);
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
  
  // Деплой модулей ОТКЛЮЧЕН - модули будут деплоиться отдельно
  console.log('[MULTI_DBG] Module deployment DISABLED - modules will be deployed separately');
  const moduleResults = [];
  const verificationResults = [];
  
  // Объединяем результаты
  const finalResults = results.map((result, index) => ({
    ...result,
    modules: moduleResults[index] || {},
    verification: verificationResults[index] || {}
  }));
  
  console.log('MULTICHAIN_DEPLOY_RESULT', JSON.stringify(finalResults));
  
  // Сохраняем каждый модуль в отдельный файл
  const dleAddress = uniqueAddresses[0];
  const modulesDir = path.join(__dirname, '../contracts-data/modules');
  if (!fs.existsSync(modulesDir)) {
    fs.mkdirSync(modulesDir, { recursive: true });
  }
  
  // Создаем файлы для каждого типа модуля
  const moduleTypes = ['treasury', 'timelock', 'reader'];
  const moduleKeys = ['treasuryModule', 'timelockModule', 'dleReader'];
  
  for (let moduleIndex = 0; moduleIndex < moduleTypes.length; moduleIndex++) {
    const moduleType = moduleTypes[moduleIndex];
    const moduleKey = moduleKeys[moduleIndex];
    
    const moduleInfo = {
      moduleType: moduleType,
      dleAddress: dleAddress,
      networks: [],
      deployTimestamp: new Date().toISOString()
    };
    
    // Собираем адреса модуля во всех сетях
    for (let i = 0; i < networks.length; i++) {
      const rpcUrl = networks[i];
      const moduleResult = moduleResults[i];
      
      try {
        const provider = new hre.ethers.JsonRpcProvider(rpcUrl);
        const network = await provider.getNetwork();
        
        moduleInfo.networks.push({
          chainId: Number(network.chainId),
          rpcUrl: rpcUrl,
          address: moduleResult && moduleResult[moduleKey] ? moduleResult[moduleKey] : null,
          verification: verificationResults[i] && verificationResults[i][moduleKey] ? verificationResults[i][moduleKey] : 'unknown'
        });
      } catch (error) {
        console.error(`[MULTI_DBG] Ошибка получения chainId для модуля ${moduleType} в сети ${i + 1}:`, error.message);
        moduleInfo.networks.push({
          chainId: null,
          rpcUrl: rpcUrl,
          address: null,
          verification: 'error'
        });
      }
    }
    
    // Сохраняем файл модуля
    const moduleFileName = `${moduleType}-${dleAddress.toLowerCase()}.json`;
    const moduleFilePath = path.join(modulesDir, moduleFileName);
    fs.writeFileSync(moduleFilePath, JSON.stringify(moduleInfo, null, 2));
    console.log(`[MULTI_DBG] Module ${moduleType} saved to: ${moduleFilePath}`);
  }
  
  console.log(`[MULTI_DBG] All modules saved to separate files in: ${modulesDir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });


