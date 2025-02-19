import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { sepolia } from '@reown/appkit/networks'

export const projectId = '9a6515f7259ebccd149fd53341e01e6b'

export const networks = [sepolia]

export const ethersAdapter = new EthersAdapter()

export const config = {
  ethereum: {
    networkUrl: import.meta.env.VITE_APP_ETHEREUM_NETWORK_URL as string,
    projectId: import.meta.env.VITE_APP_PROJECT_ID as string
  },
  api: {
    baseUrl: 'http://localhost:3000', // URL бэкенда
    endpoints: {
      verify: '/api/verify'
    }
  },
  contract: {
    address: '0x6199Ba629C85Da887dBd8Ffd8d2C75Ea24EaDe2a',
    abi: [
      'function owner() view returns (address)',
      'function setOwner(address newOwner)'
    ]
  },
  metadata: {
    name: 'DApp for Business',
    description: 'Управление смарт-контрактом',
    url: window.location.origin,
    icons: ['https://avatars.githubusercontent.com/u/37784886']
  }
};

export default config;