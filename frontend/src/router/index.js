import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
// Импортируем (пока не созданные) компоненты для подстраниц настроек
const SettingsAiView = () => import('../views/settings/AiSettingsView.vue');
const SettingsBlockchainView = () => import('../views/settings/BlockchainSettingsView.vue');
const SettingsSecurityView = () => import('../views/settings/SecuritySettingsView.vue');
const SettingsInterfaceView = () => import('../views/settings/Interface/InterfaceSettingsView.vue');

import axios from 'axios';
import { setToStorage } from '../utils/storage.js';

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
        path: '',
        name: 'settings-index',
        component: () => import('@/views/settings/SettingsIndexView.vue'),
      },
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
        path: 'webssh',
        name: 'settings-webssh',
        component: () => import('../views/settings/WebSshSettingsView.vue'),
      },

      {
        path: 'telegram',
        name: 'settings-telegram',
        component: () => import('../views/settings/AI/TelegramSettingsView.vue'),
      },
      {
        path: 'email',
        name: 'settings-email',
        component: () => import('../views/settings/AI/EmailSettingsView.vue'),
      },
    ]
  },
  {
    path: '/settings/ai/openai',
    name: 'openai-settings',
    component: () => import('@/views/settings/AI/OpenAISettingsView.vue'),
  },
  {
    path: '/settings/ai/ollama',
    name: 'ollama-settings',
    component: () => import('@/views/settings/AI/OllamaSettingsView.vue'),
  },
  {
    path: '/settings/ai/database',
    name: 'database-settings',
    component: () => import('@/views/settings/AI/DatabaseSettingsView.vue'),
  },
  {
    path: '/settings/ai/assistant',
    name: 'ai-assistant-settings',
    component: () => import('@/views/settings/AI/AiAssistantSettings.vue'),
  },
  {
    path: '/tables',
    name: 'tables-list',
    component: () => import('../views/tables/TablesListView.vue')
  },
  {
    path: '/tables/create',
    name: 'create-table',
    component: () => import('../views/tables/CreateTableView.vue')
  },
  {
    path: '/tables/:id',
    name: 'user-table-view',
    component: () => import('../views/tables/TableView.vue'),
    props: true
  },
  {
    path: '/tables/:id/edit',
    name: 'edit-table',
    component: () => import('../views/tables/EditTableView.vue'),
    props: true
  },
  {
    path: '/tables/:id/delete',
    name: 'delete-table',
    component: () => import('../views/tables/DeleteTableView.vue'),
    props: true
  },
  {
    path: '/tables/tags',
    name: 'tags-table-view',
    component: () => import('../views/tables/TagsTableViewPage.vue')
  },
  {
    path: '/contacts/:id',
    name: 'contact-details',
    component: () => import('../views/contacts/ContactDetailsView.vue'),
    props: true
  },
  {
    path: '/contacts/:id/delete',
    name: 'contact-delete-confirm',
    component: () => import('../views/contacts/ContactDeleteConfirm.vue'),
    props: true
  },
  {
    path: '/contacts-list',
    name: 'contacts-list',
    component: () => import('../views/ContactsView.vue')
  },
  {
    path: '/dle-management',
    name: 'dle-management',
    component: () => import('../views/DleManagementView.vue')
  },
  {
    path: '/settings/ai/telegram',
    name: 'telegram-settings',
    component: () => import('@/views/settings/AI/TelegramSettingsView.vue'),
  },
  {
    path: '/settings/ai/email',
    name: 'email-settings',
    component: () => import('@/views/settings/AI/EmailSettingsView.vue'),
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
      const response = await axios.get('/auth/check');
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

router.afterEach(() => {
  // Всегда закрываем сайдбар при переходе на любую страницу
  setToStorage('showWalletSidebar', false);
});

export default router;
