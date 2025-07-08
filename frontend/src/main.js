import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import axios from 'axios';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

// Настройка axios
axios.defaults.baseURL = '/api';
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

console.log('API URL:', axios.defaults.baseURL);
console.log('main.js: Starting application with router');

app.mount('#app');
console.log('main.js: Application with router mounted');
