import { createApp } from 'vue';
import App from './App.vue';
import { createAppKit } from '@reown/appkit/vue';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';
import config from './config'; // Импортируем конфигурацию

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  projectId: config.ethereum.projectId,
  networks: [sepolia],
  defaultNetwork: sepolia,
  metadata: config.metadata,
  features: {
    analytics: true
  },
  themeMode: 'light', // Добавляем светлую тему
  themeVariables: {
    '--w3m-color-mix': '#00BB7F',
    '--w3m-color-mix-strength': 40
  }
});

const app = createApp(App);
app.use(appKit); // Подключаем AppKit как плагин
app.mount('#app'); 