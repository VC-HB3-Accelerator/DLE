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

async function checkModules() {
  try {
    // Адрес DLE контракта
    const dleAddress = '0xCaa85e96a6929F0373442e31FD9888d985869EcE';
    
    // RPC URL для Sepolia
    const rpcUrl = 'https://eth-sepolia.nodereal.io/v1/56dec8028bae4f26b76099a42dae2b52';
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для DLE контракта
    const dleAbi = [
      "function modulesInitialized() external view returns (bool)",
      "function initializer() external view returns (address)",
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)",
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)",
      "function initializeBaseModules(address _treasuryAddress, address _timelockAddress, address _readerAddress) external"
    ];
    
    const dle = new ethers.Contract(dleAddress, dleAbi, provider);
    
    // Проверяем статус инициализации
    const modulesInitialized = await dle.modulesInitialized();
    console.log('Модули инициализированы:', modulesInitialized);
    
    // Получаем initializer адрес
    const initializer = await dle.initializer();
    console.log('Initializer адрес:', initializer);
    
    // Проверяем модули
    const moduleIds = {
      treasury: ethers.keccak256(ethers.toUtf8Bytes("TREASURY")),
      timelock: ethers.keccak256(ethers.toUtf8Bytes("TIMELOCK")),
      reader: ethers.keccak256(ethers.toUtf8Bytes("READER"))
    };
    
    console.log('\nПроверка модулей:');
    for (const [name, moduleId] of Object.entries(moduleIds)) {
      try {
        const isActive = await dle.isModuleActive(moduleId);
        const address = await dle.getModuleAddress(moduleId);
        console.log(`${name}: активен=${isActive}, адрес=${address}`);
      } catch (error) {
        console.log(`${name}: ошибка - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

checkModules();
