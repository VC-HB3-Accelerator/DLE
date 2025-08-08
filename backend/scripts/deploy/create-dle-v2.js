/* eslint-disable no-console */
const hre = require('hardhat');

async function main() {
  const { ethers } = hre;
  const rpcUrl = process.env.RPC_URL;
  const pk = process.env.PRIVATE_KEY;
  if (!rpcUrl || !pk) throw new Error('RPC_URL/PRIVATE_KEY required');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);

  const salt = process.env.CREATE2_SALT;
  const initCodeHash = process.env.INIT_CODE_HASH;
  let factoryAddress = process.env.FACTORY_ADDRESS;

  if (!salt || !initCodeHash) throw new Error('CREATE2_SALT/INIT_CODE_HASH required');

  // Ensure factory
  if (!factoryAddress) {
    const Factory = await hre.ethers.getContractFactory('FactoryDeployer', wallet);
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    factoryAddress = await factory.getAddress();
  } else {
    const code = await provider.getCode(factoryAddress);
    if (code === '0x') {
      const Factory = await hre.ethers.getContractFactory('FactoryDeployer', wallet);
      const factory = await Factory.deploy();
      await factory.waitForDeployment();
      factoryAddress = await factory.getAddress();
    }
  }

  // Prepare DLE init code = creation bytecode WITH constructor args
  const DLE = await hre.ethers.getContractFactory('DLE', wallet);
  const paramsPath = require('path').join(__dirname, './current-params.json');
  const params = require(paramsPath);
  const dleConfig = {
    name: params.name,
    symbol: params.symbol,
    location: params.location,
    coordinates: params.coordinates,
    jurisdiction: params.jurisdiction,
    oktmo: params.oktmo,
    okvedCodes: params.okvedCodes || [],
    kpp: params.kpp,
    quorumPercentage: params.quorumPercentage,
    initialPartners: params.initialPartners,
    initialAmounts: params.initialAmounts,
    supportedChainIds: params.supportedChainIds
  };
  const deployTx = await DLE.getDeployTransaction(dleConfig, params.currentChainId);
  const dleInit = deployTx.data; // полноценный init code

  // Deploy via factory
  const Factory = await hre.ethers.getContractAt('FactoryDeployer', factoryAddress, wallet);
  const tx = await Factory.deploy(salt, dleInit);
  const rc = await tx.wait();
  const addr = rc.logs?.[0]?.args?.addr || (await Factory.computeAddress(salt, initCodeHash));
  console.log('DLE v2 задеплоен по адресу:', addr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

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
    
    // Преобразуем initialAmounts в wei
    const initialAmountsInWei = deployParams.initialAmounts.map(amount => ethers.parseUnits(amount.toString(), 18));
    console.log("Initial amounts в wei:");
    console.log(initialAmountsInWei.map(wei => ethers.formatUnits(wei, 18) + " токенов"));

  // Получаем RPC URL и приватный ключ из переменных окружения
  const rpcUrl = process.env.RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!rpcUrl || !privateKey) {
    throw new Error('RPC_URL и PRIVATE_KEY должны быть установлены в переменных окружения');
  }
  
  // Создаем провайдер и кошелек
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);
  
  console.log(`Адрес деплоера: ${deployer.address}`);
  const balance = await provider.getBalance(deployer.address);
  console.log(`Баланс деплоера: ${ethers.formatEther(balance)} ETH`);
  
  // Проверяем, достаточно ли баланса для деплоя (минимум 0.00001 ETH для тестирования)
  const minBalance = ethers.parseEther("0.00001");
  if (balance < minBalance) {
    throw new Error(`Недостаточно ETH для деплоя. Баланс: ${ethers.formatEther(balance)} ETH, требуется минимум: ${ethers.formatEther(minBalance)} ETH. Пополните кошелек через Sepolia faucet.`);
  }

  try {
    // 1. Создаем единый контракт DLE
    console.log("\n1. Деплой единого контракта DLE v2...");
    
    const DLE = await ethers.getContractFactory("DLE", deployer);
    
    // Создаем структуру DLEConfig с полными данными
    const dleConfig = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      coordinates: deployParams.coordinates || "0,0",
      jurisdiction: deployParams.jurisdiction || 1,
      oktmo: parseInt(deployParams.oktmo) || 45000000000,
      okvedCodes: deployParams.okvedCodes || [],
      kpp: parseInt(deployParams.kpp) || 770101001,
      quorumPercentage: deployParams.quorumPercentage || 51,
      initialPartners: deployParams.initialPartners,
      initialAmounts: deployParams.initialAmounts.map(amount => ethers.parseUnits(amount.toString(), 18)),
      supportedChainIds: deployParams.supportedChainIds || [1, 137, 56, 42161] // Ethereum, Polygon, BSC, Arbitrum
    };
    
    console.log("Конфигурация DLE для записи в блокчейн:");
    console.log("Название:", dleConfig.name);
    console.log("Символ:", dleConfig.symbol);
    console.log("Местонахождение:", dleConfig.location);
    console.log("Координаты:", dleConfig.coordinates);
    console.log("Юрисдикция:", dleConfig.jurisdiction);
    console.log("ОКТМО:", dleConfig.oktmo);
    console.log("Коды ОКВЭД:", dleConfig.okvedCodes.join(', '));
    console.log("КПП:", dleConfig.kpp);
    console.log("Кворум:", dleConfig.quorumPercentage + "%");
    console.log("Партнеры:", dleConfig.initialPartners.join(', '));
    console.log("Количества токенов:", dleConfig.initialAmounts.map(amount => ethers.formatUnits(amount, 18) + " токенов").join(', '));
    console.log("Поддерживаемые сети:", dleConfig.supportedChainIds.join(', '));
    
    const currentChainId = deployParams.currentChainId || 1; // По умолчанию Ethereum
    
    const dle = await DLE.deploy(dleConfig, currentChainId);
    
    await dle.waitForDeployment();
    const dleAddress = await dle.getAddress();
    console.log(`DLE v2 задеплоен по адресу: ${dleAddress}`);

    // 2. Получаем информацию о DLE из блокчейна
    const dleInfo = await dle.getDLEInfo();
    console.log("\n2. Информация о DLE из блокчейна:");
    console.log(`Название: ${dleInfo.name}`);
    console.log(`Символ: ${dleInfo.symbol}`);
    console.log(`Местонахождение: ${dleInfo.location}`);
    console.log(`Координаты: ${dleInfo.coordinates}`);
    console.log(`Юрисдикция: ${dleInfo.jurisdiction}`);
    console.log(`ОКТМО: ${dleInfo.oktmo}`);
    console.log(`Коды ОКВЭД: ${dleInfo.okvedCodes.join(', ')}`);
    console.log(`КПП: ${dleInfo.kpp}`);
    console.log(`Дата создания: ${new Date(Number(dleInfo.creationTimestamp) * 1000).toISOString()}`);
    console.log(`Активен: ${dleInfo.isActive}`);
    
    // Проверяем, что данные записались правильно
    console.log("\n3. Проверка записи данных в блокчейн:");
    if (dleInfo.name === deployParams.name && 
        dleInfo.location === deployParams.location && 
        dleInfo.jurisdiction === deployParams.jurisdiction) {
      console.log("✅ Все данные DLE успешно записаны в блокчейн!");
      console.log("Теперь эти данные видны на Etherscan в разделе 'Contract' -> 'Read Contract'");
    } else {
      console.log("❌ Ошибка: данные не записались правильно в блокчейн");
    }

    // 4. Сохраняем информацию о созданном DLE
    console.log("\n4. Сохранение информации о DLE v2...");
    const dleData = {
      name: deployParams.name,
      symbol: deployParams.symbol,
      location: deployParams.location,
      coordinates: deployParams.coordinates || "0,0",
      jurisdiction: deployParams.jurisdiction || 1,
      oktmo: deployParams.oktmo || 45000000000,
      okvedCodes: deployParams.okvedCodes || [],
      kpp: deployParams.kpp || 770101001,
      dleAddress: dleAddress,
      creationBlock: Number(await provider.getBlockNumber()),
      creationTimestamp: Number((await provider.getBlock()).timestamp),
      deployedManually: true,
      version: "v2",
      // Сохраняем информацию о партнерах
      initialPartners: deployParams.initialPartners || [],
      initialAmounts: deployParams.initialAmounts || [],
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