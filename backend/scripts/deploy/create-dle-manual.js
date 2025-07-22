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

// Скрипт для ручного создания DLE без использования фабрики
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Получаем параметры деплоя из файла или аргументов
  const deployParams = getDeployParams();
  
  console.log("Начинаем создание нового DLE вручную (без фабрики)...");
  console.log("Параметры DLE:");
  console.log(JSON.stringify(deployParams, null, 2));

  // Получаем аккаунт деплоя
  const [deployer] = await ethers.getSigners();
  console.log(`Адрес деплоера: ${deployer.address}`);
  console.log(`Баланс деплоера: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  try {
    // 1. Создаем токен управления
    console.log("\n1. Деплой токена управления...");
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    const token = await GovernanceToken.deploy(
      deployParams.name, 
      deployParams.symbol,
      deployer.address // адрес управляющего минтом
    );
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`Токен задеплоен по адресу: ${tokenAddress}`);

    // 2. Создаем Timelock контракт
    console.log("\n2. Деплой Timelock контракта...");
    
    // Создаем временные пустые массивы
    const proposers = [deployer.address]; // Временно даем права деплоеру
    const executors = [ethers.ZeroAddress]; // Адрес 0 означает, что любой может выполнять
    
    // Минимальная задержка в секундах
    const minDelayInSeconds = deployParams.minTimelockDelay * 24 * 60 * 60; // Перевод дней в секунды
    
    const GovernanceTimelock = await ethers.getContractFactory("GovernanceTimelock");
    const timelock = await GovernanceTimelock.deploy(
      minDelayInSeconds,
      proposers,
      executors,
      deployer.address // admin
    );
    await timelock.waitForDeployment();
    const timelockAddress = await timelock.getAddress();
    console.log(`Timelock задеплоен по адресу: ${timelockAddress}`);

    // 3. Создаем Governor контракт
    console.log("\n3. Деплой Governor контракта...");
    const GovernorContract = await ethers.getContractFactory("GovernorContract");
    const governor = await GovernorContract.deploy(
      `${deployParams.name} Governor`,
      token,
      timelock,
      deployParams.votingDelay,
      deployParams.votingPeriod,
      deployParams.proposalThreshold,
      deployParams.quorumPercentage
    );
    await governor.waitForDeployment();
    const governorAddress = await governor.getAddress();
    console.log(`Governor задеплоен по адресу: ${governorAddress}`);

    // 4. Настраиваем разрешения Timelock
    console.log("\n4. Настройка разрешений Timelock...");
    
    // Отменяем временные предложения
    const tx1 = await timelock.revokeRole(await timelock.PROPOSER_ROLE(), deployer.address);
    await tx1.wait();
    console.log(`Отозвана роль PROPOSER у деплоера`);
    
    // Устанавливаем Governor как единственного proposer
    const tx2 = await timelock.grantRole(await timelock.PROPOSER_ROLE(), governorAddress);
    await tx2.wait();
    console.log(`Назначена роль PROPOSER контракту Governor`);
    
    // Отказываемся от роли администратора для Timelock
    const adminRole = await timelock.DEFAULT_ADMIN_ROLE();
    const tx3 = await timelock.revokeRole(adminRole, deployer.address);
    await tx3.wait();
    console.log(`Отозвана роль ADMIN у деплоера`);

    // 5. Распределяем начальные токены
    console.log("\n5. Распределение начальных токенов...");
    const mintTx = await token.mintInitialSupply(deployParams.partners, deployParams.amounts);
    await mintTx.wait();
    console.log(`Токены распределены между партнерами`);

    // 6. Сохраняем информацию о созданных контрактах
    console.log("\n6. Сохранение информации о DLE...");
    const dleData = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      isicCodes: deployParams.isicCodes,
      tokenAddress,
      timelockAddress,
      governorAddress,
      creationBlock: (await mintTx.provider.getBlockNumber()),
      creationTimestamp: (await mintTx.provider.getBlock()).timestamp,
      deployedManually: true
    };
    
    const saveResult = saveDLEData(dleData);
    
    console.log("\nDLE успешно создано вручную!");
    console.log(`Адрес токена: ${tokenAddress}`);
    console.log(`Адрес таймлока: ${timelockAddress}`);
    console.log(`Адрес контракта Governor: ${governorAddress}`);
    
    if (!saveResult) {
      console.warn("\nВНИМАНИЕ: Не удалось сохранить информацию о DLE в файл!");
      console.warn("Убедитесь, что директория contracts-data/dles существует и доступна для записи.");
      console.warn("Данные контрактов доступны выше в логах.");
    }

    return dleData;
  } catch (error) {
    console.error("Ошибка при создании DLE вручную:", error);
    throw error;
  }
}

// Получаем параметры деплоя из JSON-файла (переданного как аргумент)
function getDeployParams() {
  const defaultParamsPath = path.join(__dirname, 'current-params.json');
  
  if (fs.existsSync(defaultParamsPath)) {
    console.log(`Загрузка параметров из файла: ${defaultParamsPath}`);
    return JSON.parse(fs.readFileSync(defaultParamsPath, "utf8"));
  }
  
  // Используем параметры по умолчанию, если файл не найден
  console.log("Используются параметры по умолчанию");
  return {
    name: "Manual DLE",
    symbol: "MDLE",
    location: "Test Location",
    isicCodes: ["A01", "B02"],
    partners: [
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    ],
    amounts: [
      ethers.parseEther("1000000"),
      ethers.parseEther("500000")
    ],
    minTimelockDelay: 2,
    votingDelay: 1,
    votingPeriod: 45818,
    proposalThreshold: ethers.parseEther("100000"),
    quorumPercentage: 4
  };
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
    
    const fileName = `${dleData.name.replace(/\s+/g, '-')}-${Date.now()}.json`;
    const filePath = path.join(dlesDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(dleData, null, 2));
    
    console.log(`Информация о DLE сохранена в файл: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при сохранении информации о DLE: ${error.message}`);
    console.error(`Убедитесь, что директория ${dlesDir} существует и доступна для записи`);
    console.error(`Для исправления в Docker-контейнере выполните: docker exec -it [container_id] /bin/sh -c "mkdir -p /app/contracts-data/dles && chown -R node:node /app/contracts-data"`);
    return false;
  }
}

// Если скрипт выполняется напрямую
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
} else {
  // Если скрипт импортируется как модуль
  module.exports = main;
} 