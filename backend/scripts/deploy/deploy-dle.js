// Скрипт для деплоя DLE (Digital Legal Entity) контрактов
const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Начинаем деплой DLE контрактов...");

  // Получаем аккаунт деплоя
  const [deployer] = await ethers.getSigners();
  console.log(`Адрес деплоера: ${deployer.address}`);
  console.log(`Баланс деплоера: ${await ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  // Получаем фабрику контрактов
  console.log("Деплоим DLEFactory...");
  const DLEFactory = await ethers.getContractFactory("DLEFactory");
  const dleFactory = await DLEFactory.deploy(deployer.address);
  await dleFactory.waitForDeployment();
  const dleFactoryAddress = await dleFactory.getAddress();
  console.log(`DLEFactory задеплоен по адресу: ${dleFactoryAddress}`);

  // Сохраняем адреса контрактов
  saveContractData("DLEFactory", dleFactoryAddress, await getAbi("DLEFactory"));

  console.log("Деплой завершен!");
}

// Сохраняем адреса контрактов и ABI для фронтенда
function saveContractData(name, address, abi) {
  const contractsDir = path.join(__dirname, "../..", "contracts-data");
  
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(contractsDir, `${name}-address.json`),
    JSON.stringify({ address }, null, 2)
  );

  fs.writeFileSync(
    path.join(contractsDir, `${name}-abi.json`),
    JSON.stringify(abi, null, 2)
  );
}

// Получаем ABI контракта
async function getAbi(contractName) {
  const artifact = await artifacts.readArtifact(contractName);
  return artifact.abi;
}

// Запускаем скрипт деплоя
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 