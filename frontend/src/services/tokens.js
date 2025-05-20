import api from '../api/axios';

// Получение балансов токенов
export const fetchTokenBalances = async (address = null) => {
  try {
    let url = '/api/tokens/balances';
    if (address) {
      url += `?address=${encodeURIComponent(address)}`;
      console.log(`Fetching token balances for specific address: ${address}`);
    } else {
      console.log('Fetching token balances for session user');
    }
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching token balances:', error);
    return {
      eth: '0',
      bsc: '0',
      arbitrum: '0',
      polygon: '0',
      sepolia: '0',
    };
  }
};
