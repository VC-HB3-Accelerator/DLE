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

// Скрипт для создания современного DLE v2 (единый контракт)
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Получаем параметры деплоя из файла
  const deployParams = getDeployParams();
  
  console.log("Начинаем создание современного DLE v2...");
  console.log("Параметры DLE:");
  console.log(JSON.stringify(deployParams, null, 2));

  // Получаем аккаунт деплоя
  const [deployer] = await ethers.getSigners();
  console.log(`Адрес деплоера: ${deployer.address}`);
  console.log(`Баланс деплоера: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  try {
    // 1. Создаем единый контракт DLE
    console.log("\n1. Деплой единого контракта DLE v2...");
    
    const DLE = await ethers.getContractFactory("DLE");
    
    // Создаем структуру DLEConfig
    const dleConfig = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      coordinates: deployParams.coordinates || "0,0",
      jurisdiction: deployParams.jurisdiction || 1,
      oktmo: deployParams.oktmo || 45000000000,
      okvedCodes: deployParams.okvedCodes || [],
      kpp: deployParams.kpp || 770101001,
      quorumPercentage: deployParams.quorumPercentage || 51,
      initialPartners: deployParams.initialPartners,
      initialAmounts: deployParams.initialAmounts,
      supportedChainIds: deployParams.supportedChainIds || [1, 137, 56, 42161] // Ethereum, Polygon, BSC, Arbitrum
    };
    
    const currentChainId = deployParams.currentChainId || 1; // По умолчанию Ethereum
    
    const dle = await DLE.deploy(dleConfig, currentChainId);
    
    await dle.waitForDeployment();
    const dleAddress = await dle.getAddress();
    console.log(`DLE v2 задеплоен по адресу: ${dleAddress}`);

    // 2. Получаем информацию о DLE
    const dleInfo = await dle.getDLEInfo();
    console.log("\n2. Информация о DLE:");
    console.log(`Название: ${dleInfo.name}`);
    console.log(`Символ: ${dleInfo.symbol}`);
    console.log(`Местонахождение: ${dleInfo.location}`);
    console.log(`Коды деятельности: ${dleInfo.okvedCodes.join(', ')}`);
    console.log(`Дата создания: ${new Date(dleInfo.creationTimestamp * 1000).toISOString()}`);

    // 3. Сохраняем информацию о созданном DLE
    console.log("\n3. Сохранение информации о DLE v2...");
    const dleData = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      coordinates: deployParams.coordinates || "0,0",
      jurisdiction: deployParams.jurisdiction || 1,
      oktmo: deployParams.oktmo || 45000000000,
      okvedCodes: deployParams.isicCodes || [],
      kpp: deployParams.kpp || 770101001,
      dleAddress: dleAddress,
      creationBlock: (await dle.provider.getBlockNumber()),
      creationTimestamp: (await dle.provider.getBlock()).timestamp,
      deployedManually: true,
      version: "v2",
      governanceSettings: {
        quorumPercentage: deployParams.quorumPercentage || 51,
        supportedChainIds: deployParams.supportedChainIds || [1, 137, 56, 42161],
        currentChainId: currentChainId
      }
    };
    
    const saveResult = saveDLEData(dleData);
    
    console.log("\nDLE v2 успешно создан!");
    console.log(`Адрес DLE: ${dleAddress}`);
    console.log(`Версия: v2 (единый контракт)`);
    
    return {
      success: true,
      dleAddress: dleAddress,
      data: dleData
    };

  } catch (error) {
    console.error("Ошибка при создании DLE v2:", error);
    throw error;
  }
}

// Получаем параметры деплоя из файла
function getDeployParams() {
  const paramsFile = path.join(__dirname, 'current-params.json');
  
  if (!fs.existsSync(paramsFile)) {
    console.error(`Файл параметров не найден: ${paramsFile}`);
    process.exit(1);
  }
  
  try {
    const params = JSON.parse(fs.readFileSync(paramsFile, 'utf8'));
    console.log("Параметры загружены из файла");
    return params;
  } catch (error) {
    console.error("Ошибка при чтении файла параметров:", error);
    process.exit(1);
  }
}

// Сохраняем информацию о созданном DLE
function saveDLEData(dleData) {
  const dlesDir = path.join(__dirname, "../../contracts-data/dles");
  
  // Проверяем существование директории и создаем при необходимости
  try {
    if (!fs.existsSync(dlesDir)) {
      console.log(`Директория ${dlesDir} не существует, создаю...`);
      fs.mkdirSync(dlesDir, { recursive: true });
      console.log(`Директория ${dlesDir} успешно создана`);
    }
    
    // Проверяем права на запись, создавая временный файл
    const testFile = path.join(dlesDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`Директория ${dlesDir} доступна для записи`);
    
  } catch (error) {
    console.error(`Ошибка при проверке директории ${dlesDir}:`, error);
    throw error;
  }
  
  // Создаем уникальное имя файла
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `dle-v2-${timestamp}.json`;
  const filePath = path.join(dlesDir, fileName);
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(dleData, null, 2));
    console.log(`Информация о DLE сохранена в файл: ${fileName}`);
    return { success: true, filePath };
  } catch (error) {
    console.error(`Ошибка при сохранении файла ${filePath}:`, error);
    throw error;
  }
}

// Запускаем скрипт
main()
  .then(() => {
    console.log("Скрипт завершен успешно");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Скрипт завершен с ошибкой:", error);
    process.exit(1);
  }); 