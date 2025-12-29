/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
// Импортируем (пока не созданные) компоненты для подстраниц настроек
const SettingsAiView = () => import('../views/settings/AiSettingsView.vue');
const SettingsSecurityView = () => import('../views/settings/SecuritySettingsView.vue');
const SettingsInterfaceView = () => import('../views/settings/Interface/InterfaceSettingsView.vue');

import axios from 'axios';
import { setToStorage } from '../utils/storage.js';
import { PERMISSIONS, hasPermission } from './permissions.js';

// console.log('router/index.js: Script loaded');

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/blog',
    name: 'blog',
    component: () => import('../views/BlogView.vue'),
  },
  {
    path: '/blog/:slug',
    name: 'blog-article',
    component: () => import('../views/BlogView.vue'),
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
    props: true,
    // meta: { permission: PERMISSIONS.VIEW_CONTACTS } // Временно убираем проверку прав
  },
  {
    path: '/contacts/:id/delete',
    name: 'contact-delete-confirm',
    component: () => import('../views/contacts/ContactDeleteConfirm.vue'),
    props: true,
    meta: { permission: PERMISSIONS.DELETE_USER_DATA }
  },
  {
    path: '/contacts-list',
    name: 'contacts-list',
    component: () => import('../views/ContactsView.vue'),
    // meta: { permission: PERMISSIONS.VIEW_CONTACTS } // Временно убираем проверку прав
  },
  {
    path: '/admin-chat/:adminId',
    name: 'admin-chat',
    component: () => import('../views/AdminChatView.vue'),
    meta: { permission: PERMISSIONS.CHAT_WITH_ADMINS }
  },
  {
    path: '/personal-messages',
    name: 'personal-messages',
    component: () => import('../views/PersonalMessagesView.vue'),
    meta: { permission: PERMISSIONS.CHAT_WITH_ADMINS }
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
    path: '/content/templates',
    name: 'content-templates',
    component: () => import('../views/content/TemplatesListView.vue'),
  },
  {
    path: '/content/published',
    name: 'content-published',
    component: () => import('../views/content/PublishedListView.vue'),
  },
  {
    path: '/content/internal',
    name: 'content-internal',
    component: () => import('../views/content/InternalListView.vue'),
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
    path: '/content/system-messages/table',
    name: 'content-system-messages-table',
    component: () => import('../views/content/system-messages/SystemMessagesTableView.vue'),
  },
  {
    path: '/content/page/:id',
    name: 'page-view',
    component: () => import('../views/content/PageView.vue'),
  },
  {
    path: '/public/page/:id',
    name: 'public-page-view',
    component: () => import('../views/content/PublicPageView.vue'),
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
    path: '/management/dle-blocks',
    name: 'management-dle-blocks',
    component: () => import('../views/smartcontracts/DleBlocksManagementView.vue')
  },
  {
    path: '/management/proposals',
    name: 'management-proposals',
    component: () => import('../views/smartcontracts/DleProposalsView.vue')
  },
  {
    path: '/management/create-proposal',
    name: 'management-create-proposal',
    component: () => import('../views/smartcontracts/CreateProposalView.vue')
  },
  {
    path: '/management/add-module',
    name: 'management-add-module',
    component: () => import('../views/smartcontracts/AddModuleFormView.vue')
  },
  {
    path: '/management/transfer-tokens',
    name: 'management-transfer-tokens',
    component: () => import('../views/smartcontracts/TransferTokensFormView.vue')
  },
  {
    path: '/management/modules',
    name: 'management-modules',
    component: () => import('../views/smartcontracts/ModulesView.vue')
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
  {
    path: '/vds',
    name: 'vds-management',
    component: () => import('../views/VdsManagementView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS }
  },
  {
    path: '/connect-wallet',
    name: 'connect-wallet',
    component: () => import('../views/ConnectWalletView.vue')
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('../views/groups/GroupsView.vue')
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

  // Проверяем права доступа (новая система permissions)
  const requiredPermission = to.meta?.permission;
  
  if (requiredPermission) {
    try {
      const response = await axios.get('/auth/check');
      
      if (!response.data.authenticated) {
        // Неавторизованный - редирект на главную
        console.log('[Router] Доступ запрещен: требуется авторизация для', requiredPermission);
        return next({ name: 'home' });
      }
      
      // Получаем уровень доступа пользователя
      const userAccessLevel = response.data.userAccessLevel;
      if (!userAccessLevel) {
        console.log('[Router] Доступ запрещен: нет данных об уровне доступа');
        return next({ name: 'home' });
      }
      
      // Определяем роль на основе уровня доступа
      let userRole = 'user'; // по умолчанию
      if (userAccessLevel.level === 'readonly') {
        userRole = 'readonly';
      } else if (userAccessLevel.level === 'editor') {
        userRole = 'editor';
      }
      
      // Проверяем право доступа
      if (!hasPermission(userRole, requiredPermission)) {
        console.log(`[Router] Доступ запрещен: роль ${userRole} не имеет права ${requiredPermission}`);
        return next({ name: 'home' });
      }
      
      // Есть право - разрешаем переход
      next();
    } catch (error) {
      console.error('[Router] Ошибка проверки прав:', error);
      return next({ name: 'home' });
    }
  }
  else {
    next();
  }
});

router.afterEach(() => {
  // Всегда закрываем сайдбар при переходе на любую страницу
  setToStorage('showWalletSidebar', false);
});

export default router;
