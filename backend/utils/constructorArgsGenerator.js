/**
 * Централизованный генератор параметров конструктора для DLE контракта
 * Обеспечивает одинаковые параметры для деплоя и верификации
 */

/**
 * Генерирует параметры конструктора для DLE контракта
 * @param {Object} params - Параметры деплоя из базы данных
 * @param {number} chainId - ID сети для деплоя (опционально)
 * @returns {Object} Объект с параметрами конструктора
 */
function generateDLEConstructorArgs(params, chainId = null) {
  // Валидация обязательных параметров
  if (!params) {
    throw new Error('Параметры деплоя не переданы');
  }

  // Базовые параметры DLE
  const dleConfig = {
    name: params.name || '',
    symbol: params.symbol || '',
    location: params.location || '',
    coordinates: params.coordinates || '',
    jurisdiction: params.jurisdiction || 0,
    okvedCodes: params.okvedCodes || [],
    kpp: params.kpp ? BigInt(params.kpp) : 0n,
    quorumPercentage: params.quorumPercentage || 50,
    initialPartners: params.initialPartners || [],
    // Умножаем initialAmounts на 1e18 для конвертации в wei
    initialAmounts: (params.initialAmounts || []).map(amount => BigInt(amount) * BigInt(1e18)),
    supportedChainIds: (params.supportedChainIds || []).map(id => BigInt(id))
  };

  // Определяем initializer
  const initializer = params.initializer || params.initialPartners?.[0] || "0x0000000000000000000000000000000000000000";

  return {
    dleConfig,
    initializer
  };
}

/**
 * Генерирует параметры конструктора для верификации (с преобразованием в строки)
 * @param {Object} params - Параметры деплоя из базы данных
 * @param {number} chainId - ID сети для верификации (опционально)
 * @returns {Array} Массив параметров конструктора для верификации
 */
function generateVerificationArgs(params, chainId = null) {
  const { dleConfig, initializer } = generateDLEConstructorArgs(params, chainId);
  
  // Для верификации нужно преобразовать BigInt в строки
  const verificationConfig = {
    ...dleConfig,
    initialAmounts: dleConfig.initialAmounts.map(amount => amount.toString()),
    supportedChainIds: dleConfig.supportedChainIds.map(id => id.toString())
  };

  return [
    verificationConfig,
    initializer
  ];
}

/**
 * Генерирует параметры конструктора для деплоя (с BigInt)
 * @param {Object} params - Параметры деплоя из базы данных
 * @param {number} chainId - ID сети для деплоя (опционально)
 * @returns {Object} Объект с параметрами конструктора для деплоя
 */
function generateDeploymentArgs(params, chainId = null) {
  const { dleConfig, initializer } = generateDLEConstructorArgs(params, chainId);
  
  return {
    dleConfig,
    initializer
  };
}

/**
 * Валидирует параметры конструктора
 * @param {Object} params - Параметры деплоя
 * @returns {Object} Результат валидации
 */
function validateConstructorArgs(params) {
  const errors = [];
  const warnings = [];

  // Проверяем обязательные поля
  if (!params.name) errors.push('name не указан');
  if (!params.symbol) errors.push('symbol не указан');
  if (!params.location) errors.push('location не указан');
  if (!params.coordinates) errors.push('coordinates не указаны');
  if (!params.jurisdiction) errors.push('jurisdiction не указан');
  if (!params.okvedCodes || !Array.isArray(params.okvedCodes)) errors.push('okvedCodes не указан или не является массивом');
  if (!params.initialPartners || !Array.isArray(params.initialPartners)) errors.push('initialPartners не указан или не является массивом');
  if (!params.initialAmounts || !Array.isArray(params.initialAmounts)) errors.push('initialAmounts не указан или не является массивом');
  if (!params.supportedChainIds || !Array.isArray(params.supportedChainIds)) errors.push('supportedChainIds не указан или не является массивом');

  // Проверяем соответствие массивов
  if (params.initialPartners && params.initialAmounts && 
      params.initialPartners.length !== params.initialAmounts.length) {
    errors.push('Количество initialPartners не соответствует количеству initialAmounts');
  }

  // Проверяем значения
  if (params.quorumPercentage && (params.quorumPercentage < 1 || params.quorumPercentage > 100)) {
    warnings.push('quorumPercentage должен быть от 1 до 100');
  }

  if (params.initialAmounts) {
    const negativeAmounts = params.initialAmounts.filter(amount => amount < 0);
    if (negativeAmounts.length > 0) {
      errors.push('initialAmounts содержит отрицательные значения');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Логирует параметры конструктора для отладки
 * @param {Object} params - Параметры деплоя
 * @param {string} context - Контекст (deployment/verification)
 */
function logConstructorArgs(params, context = 'unknown') {
  console.log(`📊 [${context.toUpperCase()}] Параметры конструктора:`);
  console.log(`  name: "${params.name}"`);
  console.log(`  symbol: "${params.symbol}"`);
  console.log(`  location: "${params.location}"`);
  console.log(`  coordinates: "${params.coordinates}"`);
  console.log(`  jurisdiction: ${params.jurisdiction}`);
  console.log(`  okvedCodes: [${params.okvedCodes.join(', ')}]`);
  console.log(`  kpp: ${params.kpp}`);
  console.log(`  quorumPercentage: ${params.quorumPercentage}`);
  console.log(`  initialPartners: [${params.initialPartners.join(', ')}]`);
  console.log(`  initialAmounts: [${params.initialAmounts.join(', ')}]`);
  console.log(`  supportedChainIds: [${params.supportedChainIds.join(', ')}]`);
  console.log(`  governanceChainId: 1 (Ethereum)`);
  console.log(`  initializer: ${params.initializer}`);
}

module.exports = {
  generateDLEConstructorArgs,
  generateVerificationArgs,
  generateDeploymentArgs,
  validateConstructorArgs,
  logConstructorArgs
};
