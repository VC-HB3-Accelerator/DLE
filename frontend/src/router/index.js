/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
// Импортируем (пока не созданные) компоненты для подстраниц настроек
const SettingsAiView = () => import('../views/settings/AiSettingsView.vue');
const SettingsSecurityView = () => import('../views/settings/SecuritySettingsView.vue');
const SettingsInterfaceView = () => import('../views/settings/Interface/InterfaceSettingsView.vue');

import axios from 'axios';
import { setToStorage } from '../utils/storage.js';

// console.log('router/index.js: Script loaded');

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
        path: 'dle-v2-deploy',
        name: 'settings-dle-v2-deploy',
        component: () => import('../views/settings/DleDeployFormView.vue'),
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
        // children: [
        //   {
        //     path: 'webssh',
        //     name: 'settings-interface-webssh',
        //     component: () => import('../views/settings/Interface/InterfaceWebSshView.vue'),
        //   }
        // ]
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
    path: '/settings/interface/webssh',
    name: 'webssh-settings',
    component: () => import('@/views/settings/Interface/InterfaceWebSshView.vue'),
    meta: { requiresAuth: true }
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
    path: '/settings/ai/telegram',
    name: 'telegram-settings',
    component: () => import('@/views/settings/AI/TelegramSettingsView.vue'),
  },
  {
    path: '/settings/ai/email',
    name: 'email-settings',
    component: () => import('@/views/settings/AI/EmailSettingsView.vue'),
  },
  {
    path: '/content',
    name: 'content-list',
    component: () => import('../views/content/ContentListView.vue'),
  },
  {
    path: '/content/create',
    name: 'content-create',
    component: () => import('../views/ContentPageView.vue'),
  },
  {
    path: '/content/settings',
    name: 'content-settings',
    component: () => import('../views/content/ContentSettingsView.vue'),
  },
  {
    path: '/content/page/:id',
    name: 'page-view',
    component: () => import('../views/content/PageView.vue'),
  },
  {
    path: '/content/page/:id/edit',
    name: 'page-edit',
    component: () => import('../views/content/PageEditView.vue'),
  },
  {
    path: '/management',
    name: 'management',
    component: () => import('../views/ManagementView.vue')
  },
  {
    path: '/management/dle',
    name: 'management-dle',
    component: () => import('../views/smartcontracts/DleManagementView.vue')
  },
  {
    path: '/management/dle-management',
    name: 'management-dle-management',
    component: () => import('../views/smartcontracts/DleManagementView.vue')
  },
  {
    path: '/management/proposals',
    name: 'management-proposals',
    component: () => import('../views/smartcontracts/DleProposalsView.vue')
  },
  {
    path: '/management/tokens',
    name: 'management-tokens',
    component: () => import('../views/smartcontracts/TokensView.vue')
  },
  {
    path: '/management/quorum',
    name: 'management-quorum',
    component: () => import('../views/smartcontracts/QuorumView.vue')
  },
  {
    path: '/management/modules',
    name: 'management-modules',
    component: () => import('../views/smartcontracts/ModulesView.vue')
  },
  {
    path: '/management/modules/deploy/treasury',
    name: 'module-deploy-treasury',
    component: () => import('../views/smartcontracts/modules/TreasuryModuleDeployView.vue')
  },
  {
    path: '/management/modules/deploy/timelock',
    name: 'module-deploy-timelock',
    component: () => import('../views/smartcontracts/modules/TimelockModuleDeployView.vue')
  },
  {
    path: '/management/modules/deploy/communication',
    name: 'module-deploy-communication',
    component: () => import('../views/smartcontracts/modules/CommunicationModuleDeployView.vue')
  },
  {
    path: '/management/modules/deploy/application',
    name: 'module-deploy-application',
    component: () => import('../views/smartcontracts/modules/ApplicationModuleDeployView.vue')
  },
  {
    path: '/management/modules/deploy/mint',
    name: 'module-deploy-mint',
    component: () => import('../views/smartcontracts/modules/MintModuleDeploy.vue')
  },
  {
    path: '/management/modules/deploy/burn',
    name: 'module-deploy-burn',
    component: () => import('../views/smartcontracts/modules/BurnModuleDeploy.vue')
  },
  {
    path: '/management/modules/deploy/oracle',
    name: 'module-deploy-oracle',
    component: () => import('../views/smartcontracts/modules/OracleModuleDeploy.vue')
  },
  {
    path: '/management/modules/deploy/custom',
    name: 'module-deploy-custom',
    component: () => import('../views/smartcontracts/modules/ModuleDeployFormView.vue')
  },
  // {
  //   path: '/management/multisig',
  //   name: 'management-multisig',
  //   component: () => import('../views/smartcontracts/DleMultisigView.vue'),
  //   meta: { requiresAuth: true }
  // },

  {
    path: '/management/analytics',
    name: 'management-analytics',
    component: () => import('../views/smartcontracts/AnalyticsView.vue')
  },
  {
    path: '/management/history',
    name: 'management-history',
    component: () => import('../views/smartcontracts/HistoryView.vue')
  },
  {
    path: '/management/settings',
    name: 'management-settings',
    component: () => import('../views/smartcontracts/SettingsView.vue')
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// console.log('router/index.js: Router created');

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
        // Перенаправляем на главную страницу, где есть форма аутентификации
        next({ name: 'home' });
      }
    } catch (error) {
      // При ошибке также перенаправляем на главную
      next({ name: 'home' });
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
