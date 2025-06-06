import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import axios from 'axios';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

// Настройка axios
// В Docker контейнере localhost:8000 не работает, поэтому используем явное значение
const apiUrl =
  window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'http://dapp-backend:8000'; // имя контейнера backend
axios.defaults.baseURL = apiUrl;
axios.defaults.withCredentials = true;

// Создаем и монтируем приложение Vue
const app = createApp(App);

app.use(router);
app.use(ElementPlus);

// Не используем заглушки, так как сервер работает
// if (import.meta.env.DEV) {
//   Promise.all([
//     import('./mocks/chatApi.js'),
//     import('./mocks/authApi.js'),
//     import('./mocks/kanbanApi.js'),
//     import('./mocks/contractApi.js')
//   ]).catch(err => console.error('Failed to load API mocks:', err));
// }

console.log('API URL:', apiUrl);
console.log('main.js: Starting application with router');

app.mount('#app');
console.log('main.js: Application with router mounted');
