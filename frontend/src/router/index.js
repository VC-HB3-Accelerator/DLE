import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
// Импортируем (пока не созданные) компоненты для подстраниц настроек
const SettingsAiView = () => import('../views/settings/AiSettingsView.vue');
const SettingsBlockchainView = () => import('../views/settings/BlockchainSettingsView.vue');
const SettingsSecurityView = () => import('../views/settings/SecuritySettingsView.vue');
const SettingsInterfaceView = () => import('../views/settings/InterfaceSettingsView.vue');
import axios from 'axios';

console.log('router/index.js: Script loaded');

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/crm',
    name: 'crm',
    component: () => import('../views/CrmView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    // Добавляем дочерние маршруты
    children: [
      {
        path: 'ai',
        name: 'settings-ai',
        component: SettingsAiView,
      },
      {
        path: 'blockchain',
        name: 'settings-blockchain',
        component: SettingsBlockchainView,
      },
      {
        path: 'security',
        name: 'settings-security',
        component: SettingsSecurityView,
      },
      {
        path: 'interface',
        name: 'settings-interface',
        component: SettingsInterfaceView,
      },
      {
        path: 'telegram',
        name: 'settings-telegram',
        component: () => import('../views/settings/TelegramSettingsView.vue'),
      },
      {
        path: 'email',
        name: 'settings-email',
        component: () => import('../views/settings/EmailSettingsView.vue'),
      },
      // Опционально: перенаправление со /settings на первую подстраницу
      {
        path: '',
        name: 'settings-index',
        redirect: { name: 'settings-ai' }
      }
    ]
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

console.log('router/index.js: Router created');

// Защита маршрутов
router.beforeEach(async (to, from, next) => {
  // Если пытаемся перейти на несуществующий маршрут, перенаправляем на главную
  if (!to.matched.length) {
    return next({ name: 'home' });
  }

  // Проверяем аутентификацию, если маршрут требует авторизации
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    try {
      const response = await axios.get('/api/auth/check');
      if (response.data.authenticated) {
        next();
      } else {
        next('/login');
      }
    } catch (error) {
      next('/login');
    }
  } else {
    next();
  }
});

export default router;
