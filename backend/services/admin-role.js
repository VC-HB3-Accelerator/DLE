const { ethers } = require('ethers');
const logger = require('../utils/logger');
const authTokenService = require('./authTokenService');
const rpcProviderService = require('./rpcProviderService');

// Минимальный ABI для ERC20
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)'
];

/**
 * Основной метод проверки роли админа
 * @param {string} address - Адрес кошелька
 * @returns {Promise<boolean>} - Является ли пользователь админом
 */
async function checkAdminRole(address) {
  if (!address) return false;
  logger.info(`Checking admin role for address: ${address}`);
  let foundTokens = false;
  let errorCount = 0;
  const balances = {};
  // Получаем токены и RPC из базы
  const tokens = await authTokenService.getAllAuthTokens();
  const rpcProviders = await rpcProviderService.getAllRpcProviders();
  const rpcMap = {};
  for (const rpc of rpcProviders) {
    rpcMap[rpc.network_id] = rpc.rpc_url;
  }
  const checkPromises = tokens.map(async (token) => {
    try {
      const rpcUrl = rpcMap[token.network];
      if (!rpcUrl) {
        logger.error(`No RPC URL for network ${token.network}`);
        balances[token.network] = 'Error: No RPC URL';
        errorCount++;
        return null;
      }
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      // Проверяем доступность сети с таймаутом
      try {
        const networkCheckPromise = provider.getNetwork();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Network check timeout')), 3000)
        );
        await Promise.race([networkCheckPromise, timeoutPromise]);
      } catch (networkError) {
        logger.error(`Provider for ${token.network} is not available: ${networkError.message}`);
        balances[token.network] = 'Error: Network unavailable';
        errorCount++;
        return null;
      }
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balancePromise = tokenContract.balanceOf(address);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );
      const balance = await Promise.race([balancePromise, timeoutPromise]);
      const formattedBalance = ethers.formatUnits(balance, 18);
      balances[token.network] = formattedBalance;
      logger.info(`Token balance on ${token.network}:`, {
        address,
        contract: token.address,
        balance: formattedBalance,
        minBalance: token.min_balance,
        hasTokens: parseFloat(formattedBalance) >= parseFloat(token.min_balance),
      });
      if (parseFloat(formattedBalance) >= parseFloat(token.min_balance)) {
        logger.info(`Found admin tokens on ${token.network}`);
        foundTokens = true;
      }
      return { network: token.network, balance: formattedBalance };
    } catch (error) {
      logger.error(`Error checking balance in ${token.network}:`, {
        address,
        contract: token.address,
        error: error.message || 'Unknown error',
      });
      balances[token.network] = 'Error';
      errorCount++;
      return null;
    }
  });
  await Promise.all(checkPromises);
  if (errorCount === tokens.length) {
    logger.error(`All network checks for ${address} failed. Cannot verify admin status.`);
    return false;
  }
  if (foundTokens) {
    logger.info(`Admin role summary for ${address}:`, {
      networks: Object.keys(balances).filter(
        (net) => parseFloat(balances[net]) > 0 && balances[net] !== 'Error'
      ),
      balances,
    });
    logger.info(`Admin role granted for ${address}`);
    return true;
  }
  logger.info(`Admin role denied - no tokens found for ${address}`);
  return false;
}

module.exports = { checkAdminRole }; 