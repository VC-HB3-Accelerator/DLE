const db = require('../db');
const logger = require('../utils/logger');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { processMessage } = require('./ai-assistant'); // Используем AI Assistant

const ADMIN_CONTRACTS = [
  { address: "0xd95a45fc46a7300e6022885afec3d618d7d3f27c", network: "eth" },
  { address: "0x1d47f12ffA279BFE59Ab16d56fBb10d89AECdD5D", network: "bsc" },
  { address: "0xdce769b847a0a697239777d0b1c7dd33b6012ba0", network: "arbitrum" },
  { address: "0x351f59de4fedbdf7601f5592b93db3b9330c1c1d", network: "polygon" }
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

class AuthService {
  constructor() {
    this.providers = {
      eth: new ethers.JsonRpcProvider(process.env.RPC_URL_ETH),
      polygon: new ethers.JsonRpcProvider(process.env.RPC_URL_POLYGON),
      bsc: new ethers.JsonRpcProvider(process.env.RPC_URL_BSC),
      arbitrum: new ethers.JsonRpcProvider(process.env.RPC_URL_ARBITRUM)
    };
  }

  // Проверка подписи
  async verifySignature(message, signature, address) {
    try {
      if (!message || !signature || !address) return false;
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return ethers.getAddress(recoveredAddress) === ethers.getAddress(address);
    } catch (error) {
      logger.error('Error in signature verification:', error);
      return false;
    }
  }

  /**
   * Находит или создает пользователя по адресу кошелька
   * @param {string} address - Адрес кошелька
   * @returns {Promise<{userId: number, isAdmin: boolean}>}
   */
  async findOrCreateUser(address) {
    try {
      const existingUser = await db.query(
        `SELECT u.id
         FROM users u
         JOIN user_identities ui ON u.id = ui.user_id
         WHERE ui.provider = 'wallet' 
         AND LOWER(ui.provider_id) = LOWER($1)`,
        [address]
      );

      if (existingUser.rows.length > 0) {
        const userId = existingUser.rows[0].id;
        const isAdmin = await this.checkAdminRole(address);
        return { userId, isAdmin };
      }

      // Создание нового пользователя
      const result = await db.query(
        'INSERT INTO users DEFAULT VALUES RETURNING id',
        []
      );
      const userId = result.rows[0].id;

      await db.query(
        `INSERT INTO user_identities 
         (user_id, provider, provider_id, identity_type, identity_value) 
         VALUES ($1, 'wallet', $2, 'wallet', $2)`,
        [userId, address.toLowerCase()]
      );

      const isAdmin = await this.checkAdminRole(address);
      return { userId, isAdmin };
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  /**
   * Основной метод проверки роли админа
   * @param {string} address - Адрес кошелька
   * @returns {Promise<boolean>} - Является ли пользователь админом
   */
  async checkAdminRole(address) {
    if (!address) return false;
    
    logger.info(`Checking admin role for address: ${address}`);
    let foundTokens = false;
    const balances = {};
    
    for (const contract of ADMIN_CONTRACTS) {
      try {
        const provider = this.providers[contract.network];
        if (!provider) continue;
        
        const tokenContract = new ethers.Contract(
          contract.address,
          ERC20_ABI,
          provider
        );
        
        const balance = await tokenContract.balanceOf(address);
        const formattedBalance = ethers.formatUnits(balance, 18);
        balances[contract.network] = formattedBalance;
        
        logger.info(`Token balance on ${contract.network}:`, {
          address,
          contract: contract.address,
          balance: formattedBalance,
          hasTokens: balance > 0
        });

        if (balance > 0) {
          logger.info(`Found admin tokens on ${contract.network}`);
          foundTokens = true;
        }
      } catch (error) {
        logger.error(`Error checking balance in ${contract.network}:`, {
          address,
          contract: contract.address,
          error: error.message
        });
        balances[contract.network] = 'Error';
      }
    }
    
    if (foundTokens) {
      logger.info(`Admin role summary for ${address}:`, {
        networks: Object.keys(balances).filter(net => balances[net] > 0),
        balances
      });
      logger.info(`Admin role granted for ${address}`);
      return true;
    }
    
    logger.info(`Admin role denied - no tokens found for ${address}`);
    return false;
  }

  // Создание сессии с проверкой роли
  async createSession(req, { userId, address, authType, guestId }) {
    let isAdmin = false;
    
    if (address) {
      isAdmin = await this.checkAdminRole(address);
    } else if (userId) {
      const linkedWallet = await this.getLinkedWallet(userId);
      if (linkedWallet) {
        isAdmin = await this.checkAdminRole(linkedWallet);
      }
    }

    req.session.userId = userId;
    req.session.address = address;
    req.session.isAdmin = isAdmin;
    req.session.authenticated = true;
    req.session.authType = authType;
    
    if (guestId) {
      req.session.guestId = guestId;
    }
    
    await req.session.save();
  }

  // Получение связанного кошелька
  async getLinkedWallet(userId) {
    const result = await db.query(
      `SELECT identity_value as address 
       FROM user_identities 
       WHERE user_id = $1 AND identity_type = 'wallet'`,
      [userId]
    );
    return result.rows[0]?.address;
  }
}

// Создаем и экспортируем единственный экземпляр
const authService = new AuthService();
module.exports = authService;