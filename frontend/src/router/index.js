/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
    // Не /blog/settings — иначе конфликт со slug статьи «settings»
    path: '/blog/feed-settings',
    name: 'blog-feed-settings',
    component: () => import('../views/BlogFeedSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, permissionFallback: 'blog' },
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
      {
        path: 'regions',
        name: 'settings-regions',
        component: () => import('@/views/settings/RegionSettingsView.vue'),
        meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-index' },
      },
    ]
  },
  {
    path: '/settings/ai/openai',
    name: 'openai-settings',
    component: () => import('@/views/settings/AI/OpenAISettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/ollama',
    name: 'ollama-settings',
    component: () => import('@/views/settings/AI/OllamaSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/database',
    name: 'database-settings',
    component: () => import('@/views/settings/AI/DatabaseSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/assistant',
    name: 'ai-assistant-settings',
    component: () => import('@/views/settings/AI/AiAssistantSettings.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
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
    path: '/contacts/new',
    redirect: { name: 'contact-profile', params: { id: 'new' } },
  },
  {
    path: '/contacts/:id',
    component: () => import('../views/contacts/ContactDetailsLayout.vue'),
    props: true,
    children: [
      {
        path: '',
        name: 'contact-details',
        component: () => import('../views/contacts/ContactChatView.vue'),
      },
      {
        path: 'profile',
        name: 'contact-profile',
        component: () => import('../views/contacts/ContactProfileView.vue'),
      },
    ],
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
    path: '/contacts-list/broadcast',
    component: () => import('../views/contacts/BroadcastLayout.vue'),
    meta: { permission: PERMISSIONS.BROADCAST },
    children: [
      {
        path: '',
        name: 'contacts-broadcast',
        component: () => import('../views/contacts/BroadcastCreateView.vue'),
      },
      {
        path: 'analytics',
        name: 'contacts-broadcast-analytics',
        component: () => import('../views/contacts/BroadcastAnalyticsView.vue'),
      },
      {
        path: 'history',
        name: 'contacts-broadcast-history',
        component: () => import('../views/contacts/BroadcastHistoryView.vue'),
      },
    ],
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
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/email',
    name: 'email-settings',
    component: () => import('@/views/settings/AI/EmailSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, permissionFallback: 'settings-ai' },
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
    path: '/content/published/:slug',
    name: 'content-published-slug',
    component: () => import('../views/content/PublishedPageView.vue'),
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

// Защита маршрутов — только явный meta.permission / meta.requiresAuth
router.beforeEach(async (to, from, next) => {
  if (!to.matched.length) {
    return next({ name: 'home' });
  }

  const requiredPermission = to.meta?.permission;
  const requiresAuth = to.meta?.requiresAuth;

  if (!requiredPermission && !requiresAuth) {
    return next();
  }

  try {
    const response = await axios.get('/auth/check');
    const authData = response.data;

    if (!authData.authenticated) {
      console.log('[Router] Доступ запрещен: требуется авторизация для', to.path);
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    if (requiresAuth && !requiredPermission) {
      return next();
    }

    const userAccessLevel = authData.userAccessLevel;
    if (!userAccessLevel) {
      console.log('[Router] Доступ запрещен: нет данных об уровне доступа');
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    let userRole = 'user';
    if (userAccessLevel.level === 'readonly') {
      userRole = 'readonly';
    } else if (userAccessLevel.level === 'editor') {
      userRole = 'editor';
    }

    if (!hasPermission(userRole, requiredPermission)) {
      console.log(`[Router] Доступ запрещен: роль ${userRole} не имеет права ${requiredPermission}`);
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    next();
  } catch (error) {
    console.error('[Router] Ошибка проверки прав:', error);
    return next({ name: 'home' });
  }
});

router.afterEach(() => {
  // Всегда закрываем сайдбар при переходе на любую страницу
  setToStorage('showWalletSidebar', false);
});

export default router;
