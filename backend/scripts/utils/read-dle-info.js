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

// Скрипт для чтения данных DLE из блокчейна
const { ethers } = require("hardhat");

async function main() {
  // Адрес DLE контракта (замените на ваш адрес)
  const dleAddress = process.env.DLE_ADDRESS || "0x219f9665e713476B0B080bd73b8465B39dAB1E41";
  
  console.log(`Читаем данные DLE из блокчейна по адресу: ${dleAddress}`);
  
  // Получаем RPC URL из переменных окружения или используем дефолтный для Sepolia
  // Получаем RPC URL из базы данных
  const rpcService = require('../../services/rpcProviderService');
  const rpcUrl = await rpcService.getRpcUrlByChainId(11155111);
  
  // Создаем провайдер
  const provider = new ethers.JsonRpcProvider(await rpcService.getRpcUrlByChainId(11155111));
  
  try {
    // Получаем ABI контракта DLE
    const DLE = await ethers.getContractFactory("DLE");
    const dle = DLE.attach(dleAddress).connect(provider);
    
    // Читаем данные DLE из блокчейна
    console.log("\n📋 Чтение данных DLE из блокчейна...");
    
    const dleInfo = await dle.getDLEInfo();
    
    console.log("\n✅ Данные DLE из блокчейна:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🏢 Название: ${dleInfo.name}`);
    console.log(`💎 Символ: ${dleInfo.symbol}`);
    console.log(`📍 Местонахождение: ${dleInfo.location}`);
    console.log(`🌍 Координаты: ${dleInfo.coordinates}`);
    console.log(`🏛️ Юрисдикция: ${dleInfo.jurisdiction}`);
    console.log(`📊 ОКТМО: ${dleInfo.oktmo}`);
    console.log(`🏭 Коды ОКВЭД: ${dleInfo.okvedCodes.join(', ')}`);
    console.log(`🏢 КПП: ${dleInfo.kpp}`);
    console.log(`📅 Дата создания: ${new Date(Number(dleInfo.creationTimestamp) * 1000).toISOString()}`);
    console.log(`✅ Активен: ${dleInfo.isActive}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Дополнительная информация
    console.log("\n📊 Дополнительная информация:");
    const quorumPercentage = await dle.quorumPercentage();
    const currentChainId = await dle.getCurrentChainId();
    const totalSupply = await dle.totalSupply();
    
    console.log(`🗳️ Кворум: ${quorumPercentage}%`);
    console.log(`🔗 Текущая сеть: ${currentChainId}`);
    console.log(`💰 Общий запас токенов: ${ethers.formatUnits(totalSupply, 18)}`);
    
    // Проверяем информацию о токенах
    console.log("\n👥 Информация о токенах:");
    try {
      const totalSupply = await dle.totalSupply();
      console.log(`💰 Общий запас: ${ethers.formatUnits(totalSupply, 18)} токенов`);
      
      // Проверим баланс создателя контракта (адрес, который деплоил контракт)
      const deployer = "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B"; // Адрес из логов
      const deployerBalance = await dle.balanceOf(deployer);
      if (deployerBalance > 0) {
        console.log(`👤 Создатель (${deployer}): ${ethers.formatUnits(deployerBalance, 18)} токенов`);
      } else {
        console.log(`👤 Создатель (${deployer}): 0 токенов`);
      }
      
      // Проверим, есть ли другие держатели токенов
      console.log("\n🔍 Проверка распределения токенов:");
      console.log("💡 Партнеры не сохраняются в блокчейне как отдельные данные.");
      console.log("💡 Они используются только для первоначального распределения токенов.");
      console.log("💡 Информация о партнерах хранится в локальных файлах JSON.");
      
    } catch (error) {
      console.log("⚠️ Не удалось прочитать информацию о токенах:", error.message);
    }
    
    console.log("\n🌐 Ссылка на Etherscan:");
    console.log(`https://sepolia.etherscan.io/address/${dleAddress}#readContract`);
    console.log("\n💡 На Etherscan перейдите в раздел 'Contract' -> 'Read Contract'");
    console.log("   и вызовите функцию 'getDLEInfo' чтобы увидеть эти данные!");
    
  } catch (error) {
    console.error("❌ Ошибка при чтении данных DLE:", error);
    throw error;
  }
}

// Запускаем скрипт
main()
  .then(() => {
    console.log("\n✅ Скрипт завершен успешно");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Скрипт завершен с ошибкой:", error);
    process.exit(1);
  }); 