/**
 * Верификация контрактов с Hardhat V2 API
 */

const { execSync } = require('child_process');
const DeployParamsService = require('../services/deployParamsService');

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

module.exports = { verifyWithHardhatV2, verifyContracts: verifyWithHardhatV2 };
