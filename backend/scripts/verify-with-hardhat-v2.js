/**
 * Верификация контрактов с Hardhat V2 API
 */

const { execSync } = require('child_process');
const DeployParamsService = require('../services/deployParamsService');
const deploymentWebSocketService = require('../services/deploymentWebSocketService');

async function verifyWithHardhatV2(params = null, deployedNetworks = null) {
  console.log('🚀 Запуск верификации с Hardhat V2...');
  
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
    
    if (!params.etherscan_api_key) {
      throw new Error('Etherscan API ключ не найден в параметрах');
    }
    
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
    
    // Маппинг chainId на названия сетей
    const networkMap = {
      1: 'mainnet',
      11155111: 'sepolia', 
      17000: 'holesky',
      137: 'polygon',
      42161: 'arbitrumOne',
      421614: 'arbitrumSepolia',
      56: 'bsc',
      8453: 'base',
      84532: 'baseSepolia'
    };
    
    // Подготавливаем аргументы конструктора
    const constructorArgs = [
      {
        name: params.name || '',
        symbol: params.symbol || '',
        location: params.location || '',
        coordinates: params.coordinates || '',
        jurisdiction: params.jurisdiction || 0,
        oktmo: params.oktmo || '',
        okvedCodes: params.okvedCodes || [],
        kpp: params.kpp ? params.kpp : 0,
        quorumPercentage: params.quorumPercentage || 51,
        initialPartners: params.initialPartners || [],
        initialAmounts: (params.initialAmounts || []).map(amount => (parseFloat(amount) * 10**18).toString()),
        supportedChainIds: (params.supportedChainIds || []).map(id => id.toString())
      },
      (params.currentChainId || params.supportedChainIds?.[0] || 1).toString(),
      params.initializer || params.initialPartners?.[0] || "0x0000000000000000000000000000000000000000"
    ];
    
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
      
      // Создаем временный файл с аргументами конструктора
      const fs = require('fs');
      const path = require('path');
      const argsFile = path.join(__dirname, `constructor-args-${Date.now()}.json`);
      
      try {
        fs.writeFileSync(argsFile, JSON.stringify(constructorArgs, null, 2));
        
        // Формируем команду верификации с файлом аргументов
        const command = `ETHERSCAN_API_KEY="${params.etherscan_api_key}" npx hardhat verify --network ${networkName} ${address} --constructor-args ${argsFile}`;
        
        console.log(`💻 Выполняем команду: npx hardhat verify --network ${networkName} ${address} --constructor-args ${argsFile}`);
        
        const output = execSync(command, { 
          cwd: '/app',
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        console.log('✅ Верификация успешна:');
        console.log(output);
        
        verificationResults.push({ 
          success: true, 
          network: networkName,
          chainId: chainId 
        });
        
        // Удаляем временный файл
        try {
          fs.unlinkSync(argsFile);
        } catch (e) {
          console.log(`⚠️ Не удалось удалить временный файл: ${argsFile}`);
        }
        
      } catch (error) {
        // Удаляем временный файл в случае ошибки
        try {
          fs.unlinkSync(argsFile);
        } catch (e) {
          console.log(`⚠️ Не удалось удалить временный файл: ${argsFile}`);
        }
        
        const errorOutput = error.stdout || error.stderr || error.message;
        console.log('📥 Вывод команды:');
        console.log(errorOutput);
        
        if (errorOutput.includes('Already Verified')) {
          console.log('ℹ️ Контракт уже верифицирован');
          verificationResults.push({ 
            success: true, 
            network: networkName,
            chainId: chainId,
            alreadyVerified: true 
          });
        } else if (errorOutput.includes('Successfully verified')) {
          console.log('✅ Контракт успешно верифицирован!');
          verificationResults.push({ 
            success: true, 
            network: networkName,
            chainId: chainId 
          });
        } else {
          console.log('❌ Ошибка верификации');
          verificationResults.push({ 
            success: false, 
            network: networkName,
            chainId: chainId,
            error: errorOutput 
          });
        }
      }
    }
    
    // Выводим итоговые результаты
    console.log('\n📊 Итоговые результаты верификации:');
    const successful = verificationResults.filter(r => r.success).length;
    const failed = verificationResults.filter(r => !r.success).length;
    const alreadyVerified = verificationResults.filter(r => r.alreadyVerified).length;
    
    console.log(`✅ Успешно верифицировано: ${successful}`);
    console.log(`ℹ️ Уже было верифицировано: ${alreadyVerified}`);
    console.log(`❌ Ошибки: ${failed}`);
    
    verificationResults.forEach(result => {
      const status = result.success 
        ? (result.alreadyVerified ? 'ℹ️' : '✅') 
        : '❌';
      console.log(`${status} ${result.network} (${result.chainId}): ${result.success ? 'OK' : result.error?.substring(0, 100) + '...'}`);
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
    
    // Маппинг chainId на названия сетей для Hardhat
    const networkMap = {
      11155111: 'sepolia', 
      17000: 'holesky',
      421614: 'arbitrumSepolia',
      84532: 'baseSepolia'
    };
    
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
          
          // Выполняем верификацию
          const command = `ETHERSCAN_API_KEY="${params.etherscan_api_key}" npx hardhat verify --network ${networkName} ${network.address} --constructor-args ${argsFile}`;
          console.log(`📝 Команда верификации: npx hardhat verify --network ${networkName} ${network.address} --constructor-args ${argsFile}`);
          
          try {
            const output = execSync(command, { 
              cwd: '/app',
              encoding: 'utf8',
              stdio: 'pipe'
            });
            console.log(`✅ ${moduleData.moduleType} успешно верифицирован в ${networkName}`);
            console.log(output);
            
            // Уведомляем WebSocket клиентов о успешной верификации
            deploymentWebSocketService.addDeploymentLog(dleAddress, 'success', `Модуль ${moduleData.moduleType} верифицирован в ${networkName}`);
            deploymentWebSocketService.notifyModuleVerified(dleAddress, moduleData.moduleType, networkName);
          } catch (verifyError) {
            console.log(`❌ Ошибка верификации ${moduleData.moduleType} в ${networkName}: ${verifyError.message}`);
          } finally {
            // Удаляем временный файл
            if (fs.existsSync(argsFile)) {
              fs.unlinkSync(argsFile);
            }
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
