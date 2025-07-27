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
    
    // Преобразуем параметры голосования
    const votingDelay = deployParams.votingDelay || 1;
    const votingPeriod = deployParams.votingPeriod || 45818; // ~1 неделя
    const proposalThreshold = deployParams.proposalThreshold || ethers.parseEther("100000");
    const quorumPercentage = deployParams.quorumPercentage || 4;
    const minTimelockDelay = (deployParams.minTimelockDelay || 2) * 24 * 60 * 60; // дни в секунды
    
    const dle = await DLE.deploy(
      deployParams.name,
      deployParams.symbol,
      deployParams.location,
      deployParams.isicCodes || [],
      votingDelay,
      votingPeriod,
      proposalThreshold,
      quorumPercentage,
      minTimelockDelay
    );
    
    await dle.waitForDeployment();
    const dleAddress = await dle.getAddress();
    console.log(`DLE v2 задеплоен по адресу: ${dleAddress}`);

    // 2. Получаем адрес таймлока
    const timelockAddress = await dle.getTimelockAddress();
    console.log(`Таймлок создан по адресу: ${timelockAddress}`);

    // 3. Распределяем начальные токены
    console.log("\n3. Распределение начальных токенов...");
    const distributeTx = await dle.distributeInitialTokens(
      deployParams.partners,
      deployParams.amounts
    );
    await distributeTx.wait();
    console.log(`Токены распределены между партнерами`);

    // 4. Получаем информацию о DLE
    const dleInfo = await dle.getDLEInfo();
    console.log("\n4. Информация о DLE:");
    console.log(`Название: ${dleInfo.name}`);
    console.log(`Символ: ${dleInfo.symbol}`);
    console.log(`Местонахождение: ${dleInfo.location}`);
    console.log(`Коды деятельности: ${dleInfo.isicCodes.join(', ')}`);
    console.log(`Дата создания: ${new Date(dleInfo.creationTimestamp * 1000).toISOString()}`);

    // 5. Сохраняем информацию о созданном DLE
    console.log("\n5. Сохранение информации о DLE v2...");
    const dleData = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      isicCodes: deployParams.isicCodes || [],
      dleAddress: dleAddress,
      timelockAddress: timelockAddress,
      creationBlock: (await distributeTx.provider.getBlockNumber()),
      creationTimestamp: (await distributeTx.provider.getBlock()).timestamp,
      deployedManually: true,
      version: "v2",
      governanceSettings: {
        votingDelay: votingDelay,
        votingPeriod: votingPeriod,
        proposalThreshold: proposalThreshold.toString(),
        quorumPercentage: quorumPercentage,
        minTimelockDelay: deployParams.minTimelockDelay || 2
      }
    };
    
    const saveResult = saveDLEData(dleData);
    
    console.log("\nDLE v2 успешно создан!");
    console.log(`Адрес DLE: ${dleAddress}`);
    console.log(`Адрес таймлока: ${timelockAddress}`);
    console.log(`Версия: v2 (единый контракт)`);
    
    return {
      success: true,
      dleAddress: dleAddress,
      timelockAddress: timelockAddress,
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