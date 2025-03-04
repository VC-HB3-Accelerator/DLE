const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Получает экземпляр контракта по его имени
 * @param {string} contractName - Имя контракта (например, 'AccessToken')
 * @returns {Promise<ethers.Contract>} - Экземпляр контракта
 */
async function getContract(contractName) {
  try {
    // Путь к артефакту контракта
    const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
    
    // Проверка существования файла
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Артефакт контракта ${contractName} не найден по пути ${artifactPath}`);
    }
    
    // Загрузка ABI из артефакта
    const contractArtifact = require(artifactPath);
    const contractABI = contractArtifact.abi;
    
    // Получение адреса контракта из переменных окружения
    const contractAddress = process.env[`${contractName.toUpperCase()}_ADDRESS`];
    if (!contractAddress) {
      throw new Error(`Адрес контракта ${contractName} не найден в переменных окружения`);
    }
    
    // Подключение к провайдеру
    const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_NETWORK_URL);
    
    // Создание экземпляра контракта
    const contract = new ethers.Contract(contractAddress, contractABI, provider);
    
    return contract;
  } catch (error) {
    logger.error(`Ошибка при получении контракта ${contractName}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getContract
};
