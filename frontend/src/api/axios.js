import axios from 'axios';

// Создаем экземпляр axios с базовым URL
const instance = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Добавляем перехватчик для добавления заголовка авторизации
instance.interceptors.request.use(
  (config) => {
    console.log('Axios interceptor running');
    const address = localStorage.getItem('walletAddress');
    if (address) {
      console.log('Adding Authorization header in interceptor:', `Bearer ${address}`);
      config.headers.Authorization = `Bearer ${address}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default instance;