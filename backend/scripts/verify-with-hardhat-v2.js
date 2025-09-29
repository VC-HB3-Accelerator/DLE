/**
 * Верификация контрактов в Etherscan V2
 */

// const { execSync } = require('child_process'); // Удалено - больше не используем Hardhat verify
const DeployParamsService = require('../services/deployParamsService');
const deploymentWebSocketService = require('../services/deploymentWebSocketService');
const { getSecret } = require('../services/secretStore');

// Функция для определения Etherscan V2 API URL по chainId
function getEtherscanApiUrl(chainId) {
  // Используем единый Etherscan V2 API для всех сетей
  return `https://api.etherscan.io/v2/api?chainid=${chainId}`;
}

// Импортируем вспомогательную функцию
const { createStandardJsonInput: createStandardJsonInputHelper } = require('../utils/standardJsonInputHelper');

// Функция для создания стандартного JSON input
function createStandardJsonInput() {
  const path = require('path');
  const contractPath = path.join(__dirname, '../contracts/DLE.sol');
  return createStandardJsonInputHelper(contractPath, 'DLE');
}

// Функция для проверки статуса верификации
async function checkVerificationStatus(chainId, guid, apiKey) {
  const apiUrl = getEtherscanApiUrl(chainId);
  
  const formData = new URLSearchParams({
    apikey: apiKey,
    module: 'contract',
    action: 'checkverifystatus',
    guid: guid
  });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Ошибка при проверке статуса:', error.message);
    return { status: '0', message: error.message };
  }
}

// Функция для проверки реального статуса контракта в Etherscan
async function checkContractVerificationStatus(chainId, contractAddress, apiKey) {
  const apiUrl = getEtherscanApiUrl(chainId);
  
  const formData = new URLSearchParams({
    apikey: apiKey,
    module: 'contract',
    action: 'getsourcecode',
    address: contractAddress
  });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.status === '1' && result.result && result.result[0]) {
      const contractInfo = result.result[0];
      const isVerified = contractInfo.SourceCode && contractInfo.SourceCode !== '';
      
      console.log(`🔍 Статус контракта ${contractAddress}:`, {
        isVerified: isVerified,
        contractName: contractInfo.ContractName || 'Unknown',
        compilerVersion: contractInfo.CompilerVersion || 'Unknown'
      });
      
      return { isVerified, contractInfo };
    } else {
      console.log('❌ Не удалось получить информацию о контракте:', result.message);
      return { isVerified: false, error: result.message };
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке статуса контракта:', error.message);
    return { isVerified: false, error: error.message };
  }
}

// Функция для верификации контракта в Etherscan V2
async function verifyContractInEtherscan(chainId, contractAddress, constructorArgsHex, apiKey) {
  const apiUrl = getEtherscanApiUrl(chainId);
  const standardJsonInput = createStandardJsonInput();
  
  console.log(`🔍 Верификация контракта ${contractAddress} в Etherscan V2 (chainId: ${chainId})`);
  console.log(`📡 API URL: ${apiUrl}`);
  
  const formData = new URLSearchParams({
    apikey: apiKey,
    module: 'contract',
    action: 'verifysourcecode',
    contractaddress: contractAddress,
    codeformat: 'solidity-standard-json-input',
    contractname: 'DLE.sol:DLE',
    sourceCode: JSON.stringify(standardJsonInput),
    compilerversion: 'v0.8.20+commit.a1b79de6',
    optimizationUsed: '1',
    runs: '0',
    constructorArguements: constructorArgsHex
  });
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    const result = await response.json();
    console.log('📥 Ответ от Etherscan V2:', result);
    
    if (result.status === '1') {
      console.log('✅ Верификация отправлена в Etherscan V2!');
      console.log(`📋 GUID: ${result.result}`);
      
      // Ждем и проверяем статус верификации с повторными попытками
      console.log('⏳ Ждем 15 секунд перед проверкой статуса...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Проверяем статус с повторными попытками (до 3 раз)
      let statusResult;
      let attempts = 0;
      const maxAttempts = 3;
      
      do {
        attempts++;
        console.log(`📊 Проверка статуса верификации (попытка ${attempts}/${maxAttempts})...`);
        statusResult = await checkVerificationStatus(chainId, result.result, apiKey);
        console.log('📊 Статус верификации:', statusResult);
        
        if (statusResult.status === '1') {
          console.log('🎉 Верификация успешна!');
          return { success: true, guid: result.result, message: 'Верифицировано в Etherscan V2' };
        } else if (statusResult.status === '0' && statusResult.result.includes('Pending')) {
          console.log('⏳ Верификация в очереди, проверяем реальный статус контракта...');
          
          // Проверяем реальный статус контракта в Etherscan
          const contractStatus = await checkContractVerificationStatus(chainId, contractAddress, apiKey);
          if (contractStatus.isVerified) {
            console.log('✅ Контракт уже верифицирован в Etherscan!');
            return { success: true, guid: result.result, message: 'Контракт верифицирован' };
          } else {
            console.log('⏳ Контракт еще не верифицирован, ожидаем завершения...');
            if (attempts < maxAttempts) {
              console.log(`⏳ Ждем еще 10 секунд перед следующей попыткой...`);
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
          }
        } else {
          console.log('❌ Верификация не удалась:', statusResult.result);
          return { success: false, error: statusResult.result };
        }
      } while (attempts < maxAttempts && statusResult.status === '0' && statusResult.result.includes('Pending'));
      
      // Если все попытки исчерпаны
      if (attempts >= maxAttempts) {
        console.log('⏳ Максимальное количество попыток достигнуто, верификация может быть в процессе...');
        return { success: false, error: 'Ожидание верификации', guid: result.result };
      }
    } else {
      console.log('❌ Ошибка отправки верификации в Etherscan V2:', result.message);
      
      // Проверяем, не верифицирован ли уже контракт
      if (result.message && result.message.includes('already verified')) {
        console.log('✅ Контракт уже верифицирован');
        return { success: true, message: 'Контракт уже верифицирован' };
      }
      
      return { success: false, error: result.message };
    }
  } catch (error) {
    console.error('❌ Ошибка при отправке запроса в Etherscan V2:', error.message);
    
    // Проверяем, не является ли это ошибкой сети
    if (error.message.includes('fetch') || error.message.includes('network')) {
      console.log('⚠️ Ошибка сети, верификация может быть в процессе...');
      return { success: false, error: 'Network error - verification may be in progress' };
    }
    
    return { success: false, error: error.message };
  }
}

async function verifyWithHardhatV2(params = null, deployedNetworks = null) {
  console.log('🚀 Запуск верификации контрактов...');
  
  try {
    // Если параметры не переданы, получаем их из базы данных
    if (!params) {
      const DeployParamsService = require('../services/deployParamsService');
      const deployParamsService = new DeployParamsService();
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      
      if (latestParams.length === 0) {
        throw new Error('Нет параметров деплоя в базе данных');
      }
      
      params = latestParams[0];
    }
    
    // Проверяем API ключ в параметрах или переменной окружения
    const etherscanApiKey = params.etherscan_api_key || process.env.ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      throw new Error('Etherscan API ключ не найден в параметрах или переменной окружения');
    }
    
    // Устанавливаем API ключ в переменную окружения для использования в коде
    process.env.ETHERSCAN_API_KEY = etherscanApiKey;
    
    console.log('📋 Параметры деплоя:', {
      deploymentId: params.deployment_id,
      name: params.name,
      symbol: params.symbol
    });
    
    // Получаем адреса контрактов
    let networks = [];
    
    if (deployedNetworks && Array.isArray(deployedNetworks)) {
      // Используем переданные данные о сетях
      networks = deployedNetworks;
      console.log('📊 Используем переданные данные о развернутых сетях');
    } else if (params.deployedNetworks && Array.isArray(params.deployedNetworks)) {
      networks = params.deployedNetworks;
    } else if (params.dle_address && params.supportedChainIds) {
      // Создаем deployedNetworks на основе dle_address и supportedChainIds
      networks = params.supportedChainIds.map(chainId => ({
        chainId: chainId,
        address: params.dle_address
      }));
      console.log('📊 Создали deployedNetworks на основе dle_address и supportedChainIds');
    } else {
      throw new Error('Нет данных о развернутых сетях или адресе контракта');
    }
    console.log(`🌐 Найдено ${networks.length} развернутых сетей`);
    
    // Получаем маппинг chainId на названия сетей из параметров деплоя
    const networkMap = {};
    if (params.supportedChainIds && params.supportedChainIds.length > 0) {
      // Создаем маппинг только для поддерживаемых сетей
      for (const chainId of params.supportedChainIds) {
        switch (chainId) {
          case 1: networkMap[chainId] = 'mainnet'; break;
          case 11155111: networkMap[chainId] = 'sepolia'; break;
          case 17000: networkMap[chainId] = 'holesky'; break;
          case 137: networkMap[chainId] = 'polygon'; break;
          case 42161: networkMap[chainId] = 'arbitrumOne'; break;
          case 421614: networkMap[chainId] = 'arbitrumSepolia'; break;
          case 56: networkMap[chainId] = 'bsc'; break;
          case 8453: networkMap[chainId] = 'base'; break;
          case 84532: networkMap[chainId] = 'baseSepolia'; break;
          default: networkMap[chainId] = `chain-${chainId}`; break;
        }
      }
    } else {
      // Fallback для совместимости
      networkMap[11155111] = 'sepolia';
      networkMap[17000] = 'holesky';
      networkMap[421614] = 'arbitrumSepolia';
      networkMap[84532] = 'baseSepolia';
    }
    
    // Используем централизованный генератор параметров конструктора
    const { generateVerificationArgs } = require('../utils/constructorArgsGenerator');
    const constructorArgs = generateVerificationArgs(params);
    
    console.log('📊 Аргументы конструктора подготовлены');
    
    // Верифицируем контракт в каждой сети
    const verificationResults = [];
    
    for (const network of networks) {
      const { chainId, address } = network;
      
      if (!address || address === '0x0000000000000000000000000000000000000000') {
        console.log(`⚠️ Пропускаем сеть ${chainId} - нет адреса контракта`);
        verificationResults.push({ 
          success: false, 
          network: chainId, 
          error: 'No contract address' 
        });
        continue;
      }
      
      const networkName = networkMap[chainId];
      if (!networkName) {
        console.log(`⚠️ Неизвестная сеть ${chainId}, пропускаем верификацию`);
        verificationResults.push({ 
          success: false, 
          network: chainId, 
          error: 'Unknown network' 
        });
        continue;
      }
      
      console.log(`\n🔍 Верификация в сети ${networkName} (chainId: ${chainId})`);
      console.log(`📍 Адрес: ${address}`);
      
      // Добавляем задержку между верификациями
      if (verificationResults.length > 0) {
        console.log('⏳ Ждем 5 секунд перед следующей верификацией...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Получаем API ключ Etherscan
      const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
      if (!etherscanApiKey) {
        console.log('❌ API ключ Etherscan не найден, пропускаем верификацию в Etherscan');
        verificationResults.push({ 
          success: false, 
          network: networkName,
          chainId: chainId,
          error: 'No Etherscan API key' 
        });
        continue;
      }
      
      // Кодируем аргументы конструктора в hex
      const { ethers } = require('ethers');
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      
      // Используем централизованный генератор параметров конструктора
      const { generateDeploymentArgs } = require('../utils/constructorArgsGenerator');
      const { dleConfig, initializer } = generateDeploymentArgs(params);
      
      const encodedArgs = abiCoder.encode(
        [
          'tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, uint256 quorumPercentage, address[] initialPartners, uint256[] initialAmounts, uint256[] supportedChainIds)',
          'address'
        ],
        [
          dleConfig,
          initializer
        ]
      );
      
      const constructorArgsHex = encodedArgs.slice(2); // Убираем 0x
      
      // Верификация в Etherscan
      console.log('🌐 Верификация в Etherscan...');
      const etherscanResult = await verifyContractInEtherscan(chainId, address, constructorArgsHex, etherscanApiKey);
      
      if (etherscanResult.success) {
        console.log('✅ Верификация в Etherscan успешна!');
        verificationResults.push({ 
          success: true, 
          network: networkName,
          chainId: chainId,
          etherscan: true,
          message: etherscanResult.message
        });
      } else {
        console.log('❌ Ошибка верификации в Etherscan:', etherscanResult.error);
        verificationResults.push({ 
          success: false, 
          network: networkName,
          chainId: chainId,
          error: etherscanResult.error
        });
      }
    }
    
    // Выводим итоговые результаты
    console.log('\n📊 Итоговые результаты верификации:');
    const successful = verificationResults.filter(r => r.success).length;
    const failed = verificationResults.filter(r => !r.success).length;
    const etherscanVerified = verificationResults.filter(r => r.etherscan).length;
    
    console.log(`✅ Успешно верифицировано: ${successful}`);
    console.log(`🌐 В Etherscan: ${etherscanVerified}`);
    console.log(`❌ Ошибки: ${failed}`);
    
    verificationResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      
      const message = result.success 
        ? (result.message || 'OK')
        : result.error?.substring(0, 100) + '...';
        
      console.log(`${status} ${result.network} (${result.chainId}): ${message}`);
    });
    
    console.log('\n🎉 Верификация завершена!');
    
  } catch (error) {
    console.error('💥 Ошибка верификации:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Запускаем верификацию если скрипт вызван напрямую
if (require.main === module) {
  // Проверяем аргументы командной строки
  const args = process.argv.slice(2);
  
  if (args.includes('--modules')) {
    // Верификация модулей
    verifyModules()
      .then(() => {
        console.log('\n🏁 Верификация модулей завершена');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Верификация модулей завершилась с ошибкой:', error);
        process.exit(1);
      });
  } else {
    // Верификация основного DLE контракта
    verifyWithHardhatV2()
      .then(() => {
        console.log('\n🏁 Скрипт завершен');
        process.exit(0);
      })
      .catch((error) => {
        console.error('💥 Скрипт завершился с ошибкой:', error);
        process.exit(1);
      });
  }
}

// Функция для верификации модулей
async function verifyModules() {
  console.log('🚀 Запуск верификации модулей...');
  
  try {
    // Загружаем параметры из базы данных
    const deployParamsService = new DeployParamsService();
    const paramsArray = await deployParamsService.getLatestDeployParams(1);
    
    if (paramsArray.length === 0) {
      throw new Error('Нет параметров деплоя в базе данных');
    }
    
    const params = paramsArray[0];
    const dleAddress = params.dle_address;
    
    if (!dleAddress) {
      throw new Error('Адрес DLE не найден в параметрах');
    }
    
    // Уведомляем WebSocket клиентов о начале верификации
    deploymentWebSocketService.addDeploymentLog(dleAddress, 'info', 'Начало верификации модулей');
    
    console.log('📋 Параметры верификации модулей:', {
      dleAddress: dleAddress,
      name: params.name,
      symbol: params.symbol
    });
    
    // Читаем файлы модулей
    const fs = require('fs');
    const path = require('path');
    const modulesDir = path.join(__dirname, 'contracts-data/modules');
    
    if (!fs.existsSync(modulesDir)) {
      console.log('📁 Папка модулей не найдена:', modulesDir);
      return;
    }
    
    const moduleFiles = fs.readdirSync(modulesDir).filter(file => file.endsWith('.json'));
    console.log(`📁 Найдено ${moduleFiles.length} файлов модулей`);
    
    // Конфигурация модулей для верификации
    const MODULE_CONFIGS = {
      treasury: {
        contractName: 'TreasuryModule',
        constructorArgs: (dleAddress, chainId, walletAddress) => [
          dleAddress,
          chainId,
          walletAddress
        ]
      },
      timelock: {
        contractName: 'TimelockModule',
        constructorArgs: (dleAddress, chainId, walletAddress) => [
          dleAddress
        ]
      },
      reader: {
        contractName: 'DLEReader',
        constructorArgs: (dleAddress, chainId, walletAddress) => [
          dleAddress
        ]
      },
      hierarchicalVoting: {
        contractName: 'HierarchicalVotingModule',
        constructorArgs: (dleAddress, chainId, walletAddress) => [
          dleAddress
        ]
      }
    };
    
    // Получаем маппинг chainId на названия сетей из параметров деплоя
    const networkMap = {};
    if (params.supportedChainIds && params.supportedChainIds.length > 0) {
      // Создаем маппинг только для поддерживаемых сетей
      for (const chainId of params.supportedChainIds) {
        switch (chainId) {
          case 11155111: networkMap[chainId] = 'sepolia'; break;
          case 17000: networkMap[chainId] = 'holesky'; break;
          case 421614: networkMap[chainId] = 'arbitrumSepolia'; break;
          case 84532: networkMap[chainId] = 'baseSepolia'; break;
          default: networkMap[chainId] = `chain-${chainId}`; break;
        }
      }
    } else {
      // Fallback для совместимости
      networkMap[11155111] = 'sepolia';
      networkMap[17000] = 'holesky';
      networkMap[421614] = 'arbitrumSepolia';
      networkMap[84532] = 'baseSepolia';
    }
    
    // Верифицируем каждый модуль
    for (const file of moduleFiles) {
      const filePath = path.join(modulesDir, file);
      const moduleData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const moduleConfig = MODULE_CONFIGS[moduleData.moduleType];
      if (!moduleConfig) {
        console.log(`⚠️ Неизвестный тип модуля: ${moduleData.moduleType}`);
        continue;
      }
      
      console.log(`🔍 Верификация модуля: ${moduleData.moduleType}`);
      
      // Верифицируем в каждой сети
      for (const network of moduleData.networks) {
        if (!network.success || !network.address) {
          console.log(`⚠️ Пропускаем сеть ${network.chainId} - модуль не задеплоен`);
          continue;
        }
        
        const networkName = networkMap[network.chainId];
        if (!networkName) {
          console.log(`⚠️ Неизвестная сеть: ${network.chainId}`);
          continue;
        }
        
        try {
          console.log(`🔍 Верификация ${moduleData.moduleType} в сети ${networkName} (${network.chainId})`);
          
          // Подготавливаем аргументы конструктора
          const constructorArgs = moduleConfig.constructorArgs(
            dleAddress, 
            network.chainId, 
            params.initializer || "0x0000000000000000000000000000000000000000"
          );
          
          // Создаем временный файл с аргументами
          const argsFile = path.join(__dirname, `temp-args-${Date.now()}.json`);
          fs.writeFileSync(argsFile, JSON.stringify(constructorArgs, null, 2));
          
          // Верификация модулей через Etherscan V2 API (пока не реализовано)
          console.log(`⚠️ Верификация модулей через Etherscan V2 API пока не реализована для ${moduleData.moduleType} в ${networkName}`);
          
          // Удаляем временный файл
          if (fs.existsSync(argsFile)) {
            fs.unlinkSync(argsFile);
          }
          
        } catch (error) {
          console.error(`❌ Ошибка при верификации ${moduleData.moduleType} в сети ${network.chainId}:`, error.message);
        }
      }
    }
    
    console.log('\n🏁 Верификация модулей завершена');
    
    // Уведомляем WebSocket клиентов о завершении верификации
    deploymentWebSocketService.addDeploymentLog(dleAddress, 'success', 'Верификация всех модулей завершена');
    deploymentWebSocketService.notifyModulesUpdated(dleAddress);
    
  } catch (error) {
    console.error('❌ Ошибка при верификации модулей:', error.message);
    throw error;
  }
}

module.exports = { verifyWithHardhatV2, verifyContracts: verifyWithHardhatV2, verifyModules };
