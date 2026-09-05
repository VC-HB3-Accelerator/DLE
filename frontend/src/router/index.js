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

import axios from 'axios';
import { setToStorage } from '../utils/storage.js';
import { PERMISSIONS } from './permissions.js';
import {
  ensureScreenAccessLoaded,
  canAccessPath,
  syncScreenAccessRole
} from '@/composables/useScreenAccess.js';
import {
  ensureActionAccessLoaded,
  syncActionAccessRole,
  hasActionAccess
} from '@/composables/useActionAccess.js';
import { userId as sessionUserId } from '@/composables/useAuth';

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
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'blog', permissionFallback: 'blog' },
  },
  {
    path: '/blog/:slug',
    name: 'blog-article',
    component: () => import('../views/BlogView.vue'),
  },
  {
    path: '/crm',
    name: 'crm',
    redirect: { name: 'management' },
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
        redirect: { name: 'management' },
      },
      {
        path: 'ai',
        name: 'settings-ai',
        meta: { closeFallback: 'settings-index' },
        component: SettingsAiView,
      },

      {
        path: 'dle-v2-deploy',
        name: 'settings-dle-v2-deploy',
        component: () => import('../views/settings/DleDeployFormView.vue'),
        meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-security', permissionFallback: 'settings-security' },
      },
      {
        path: 'security/rpc',
        name: 'settings-security-rpc',
        meta: { closeFallback: 'settings-security' },
        component: () => import('../views/settings/RpcProvidersSettingsView.vue'),
      },
      {
        path: 'security/auth',
        name: 'settings-security-auth',
        meta: { closeFallback: 'settings-security' },
        component: () => import('../views/settings/AuthTokensSettingsView.vue'),
      },
      {
        path: 'security/roles',
        name: 'settings-security-roles',
        component: () => import('../views/settings/UserRolesSettingsView.vue'),
        meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-security', permissionFallback: 'settings-security' },
      },
      {
        path: 'security/roles/messages',
        redirect: { name: 'settings-security-roles', query: { tab: 'messages' } },
      },
      {
        path: 'security/roles/screens',
        redirect: { name: 'settings-security-roles', query: { tab: 'screens' } },
      },
      {
        path: 'security/roles/ai-agent',
        redirect: { name: 'settings-security-roles', query: { tab: 'ai' } },
      },
      {
        path: 'security',
        name: 'settings-security',
        meta: { closeFallback: 'settings-index' },
        component: SettingsSecurityView,
      },
      {
        path: 'interface',
        name: 'settings-interface',
        redirect: { name: 'vds-management', query: { tab: 'hosting' } },
      },
      {
        path: 'webssh',
        redirect: { name: 'webssh-settings' },
      },
      {
        path: 'updates',
        name: 'settings-updates',
        component: () => import('@/views/settings/UpdatesSettingsView.vue'),
        meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
      },
      {
        path: 'telegram',
        redirect: { name: 'telegram-settings' },
      },
      {
        path: 'email',
        redirect: { name: 'email-settings' },
      },
      {
        path: 'sidebar',
        name: 'settings-sidebar',
        component: () => import('@/views/settings/SidebarSettingsView.vue'),
        meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
        redirect: { name: 'settings-sidebar-text' },
        children: [
          {
            path: 'text',
            name: 'settings-sidebar-text',
            component: () => import('@/views/settings/SidebarTextSettingsTab.vue'),
            meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
          },
          {
            path: 'languages',
            name: 'settings-sidebar-languages',
            component: () => import('@/views/settings/SidebarLanguagesSettingsTab.vue'),
            meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
          },
          {
            path: 'auth',
            name: 'settings-sidebar-auth',
            component: () => import('@/views/settings/SidebarAuthMethodsSettingsTab.vue'),
            meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
          },
          {
            path: 'buttons',
            name: 'settings-sidebar-buttons',
            component: () => import('@/views/settings/SidebarButtonsSettingsTab.vue'),
            meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
          },
          {
            path: 'regions',
            name: 'settings-sidebar-regions',
            component: () => import('@/views/settings/RegionSettingsView.vue'),
            meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-index', permissionFallback: 'settings-index' },
          },
        ],
      },
      {
        path: 'sidebar-notice',
        redirect: { name: 'settings-sidebar-text' },
      },
      {
        path: 'regions',
        redirect: { name: 'settings-sidebar-regions' },
      },
    ]
  },
  {
    path: '/settings/ai/openai',
    name: 'openai-settings',
    component: () => import('@/views/settings/AI/OpenAISettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/deepseek',
    name: 'deepseek-settings',
    component: () => import('@/views/settings/AI/DeepSeekSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/qwencloud',
    name: 'qwencloud-settings',
    component: () => import('@/views/settings/AI/QwenCloudSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/vpn',
    name: 'vpn-settings',
    component: () => import('@/views/settings/AI/VpnSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/ollama',
    name: 'ollama-settings',
    component: () => import('@/views/settings/AI/OllamaSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/database',
    name: 'database-settings',
    component: () => import('@/views/settings/AI/DatabaseSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/assistant',
    name: 'ai-assistant-settings',
    component: () => import('@/views/settings/AI/AiAssistantSettings.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/agent-access',
    name: 'ai-agent-access-settings',
    redirect: { name: 'settings-security-roles', query: { tab: 'ai' } },
  },
  {
    path: '/settings/ai/voice-call',
    name: 'ai-voice-call-settings',
    component: () => import('@/views/settings/AI/AiVoiceCallSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/rag',
    name: 'ai-rag-settings',
    component: () => import('@/views/settings/AI/AiRagSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/interface/webssh',
    name: 'webssh-settings',
    component: () => import('@/views/settings/Interface/InterfaceWebSshView.vue'),
    meta: { requiresAuth: true, closeFallback: '/vds?tab=hosting' }
  },
  {
    path: '/tables',
    name: 'tables-list',
    meta: { closeFallback: 'crm' },
    component: () => import('../views/tables/TablesListView.vue')
  },
  {
    path: '/tables/create',
    name: 'create-table',
    meta: { closeFallback: 'tables-list' },
    component: () => import('../views/tables/CreateTableView.vue')
  },
  {
    path: '/tables/:id',
    name: 'user-table-view',
    meta: { closeFallback: 'tables-list' },
    component: () => import('../views/tables/TableView.vue'),
    props: true
  },
  {
    path: '/tables/:id/edit',
    name: 'edit-table',
    meta: { closeFallback: 'tables-list' },
    component: () => import('../views/tables/EditTableView.vue'),
    props: true
  },
  {
    path: '/tables/:id/delete',
    name: 'delete-table',
    meta: { closeFallback: 'tables-list' },
    component: () => import('../views/tables/DeleteTableView.vue'),
    props: true
  },
  {
    path: '/book-call',
    name: 'voice-call-booking',
    component: () => import('../views/chat/VoiceCallBookingView.vue'),
    meta: { closeFallback: 'home' },
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
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/ContactChatView.vue'),
      },
      {
        path: 'profile',
        name: 'contact-profile',
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/ContactProfileView.vue'),
      },
      {
        path: 'orders',
        name: 'contact-orders',
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/ContactOrdersView.vue'),
      },
      {
        path: 'cart',
        name: 'contact-cart',
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/ContactCartView.vue'),
      },
      {
        path: 'conference',
        component: () => import('../views/contacts/ConferenceSectionLayout.vue'),
        meta: { permission: PERMISSIONS.EDIT_CONTACTS },
        children: [
          {
            path: '',
            name: 'contact-conference',
            meta: { closeFallback: 'contacts-list' },
            component: () => import('../views/contacts/ConferenceSettingsView.vue'),
          },
          {
            path: 'agent',
            name: 'contact-conference-agent',
            component: () => import('../views/contacts/ConferenceAgentView.vue'),
            meta: { editorOnly: true, closeFallback: 'contact-conference' },
          },
          {
            path: 'live/:sessionId',
            name: 'contact-conference-live',
            meta: { closeFallback: 'contact-conference' },
            component: () => import('../views/contacts/ConferenceLiveView.vue'),
          },
        ],
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
    path: '/conferences',
    component: () => import('../views/contacts/ConferenceHubLayout.vue'),
    meta: { permission: PERMISSIONS.EDIT_CONTACTS },
    children: [
      {
        path: '',
        name: 'hub-conferences',
        meta: { closeFallback: 'crm' },
        component: () => import('../views/contacts/ConferenceHubHomeView.vue'),
      },
      {
        path: 'schedule',
        name: 'hub-conference-schedule',
        meta: { closeFallback: 'hub-conferences' },
        component: () => import('../views/contacts/VoiceCallScheduleView.vue'),
      },
      {
        path: ':sessionId',
        name: 'hub-conference',
        meta: { closeFallback: 'hub-conferences' },
        component: () => import('../views/contacts/ConferenceHubSettingsView.vue'),
      },
      {
        path: ':sessionId/agent',
        name: 'hub-conference-agent',
        component: () => import('../views/contacts/ConferenceAgentView.vue'),
        meta: { editorOnly: true, closeFallback: 'hub-conferences' },
      },
      {
        path: ':sessionId/live',
        name: 'hub-conference-live',
        meta: { closeFallback: 'hub-conferences' },
        component: () => import('../views/contacts/ConferenceLiveView.vue'),
      },
    ],
  },
  {
    path: '/contacts-list',
    name: 'contacts-list',
    component: () => import('../views/ContactsView.vue'),
    meta: { permission: PERMISSIONS.VIEW_CONTACTS, closeFallback: 'crm' },
  },
  {
    path: '/contacts-list/import',
    name: 'contacts-import',
    meta: { permission: PERMISSIONS.EDIT_CONTACTS, closeFallback: 'contacts-list' },
    component: () => import('../views/contacts/ContactImportView.vue'),
  },
  {
    path: '/contacts-list/parser',
    component: () => import('../views/contacts/ContactSiteParserLayout.vue'),
    meta: { permission: PERMISSIONS.EDIT_CONTACTS },
    children: [
      {
        path: '',
        name: 'contacts-site-parser',
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/ContactSiteParserView.vue'),
      },
    ],
  },
  {
    path: '/contacts-list/broadcast',
    component: () => import('../views/contacts/BroadcastLayout.vue'),
    meta: { permission: PERMISSIONS.BROADCAST },
    children: [
      {
        path: '',
        name: 'contacts-broadcast',
        meta: { closeFallback: 'contacts-list' },
        component: () => import('../views/contacts/BroadcastCreateView.vue'),
      },
      {
        path: 'agent',
        name: 'contacts-broadcast-agent',
        meta: { closeFallback: 'contacts-broadcast' },
        component: () => import('../views/contacts/BroadcastAgentView.vue'),
      },
      {
        path: 'analytics',
        name: 'contacts-broadcast-analytics',
        meta: { closeFallback: 'contacts-broadcast' },
        component: () => import('../views/contacts/BroadcastAnalyticsView.vue'),
      },
      {
        path: 'history',
        name: 'contacts-broadcast-history',
        meta: { closeFallback: 'contacts-broadcast' },
        component: () => import('../views/contacts/BroadcastHistoryView.vue'),
      },
    ],
  },
  {
    path: '/admin-chat/:adminId',
    name: 'admin-chat',
    component: () => import('../views/AdminChatView.vue'),
    meta: { permission: PERMISSIONS.CHAT_WITH_ADMINS, closeFallback: 'personal-messages' }
  },
  {
    path: '/personal-messages',
    name: 'personal-messages',
    component: () => import('../views/PersonalMessagesView.vue'),
    meta: { permission: PERMISSIONS.CHAT_WITH_ADMINS, closeFallback: 'crm' }
  },

  {
    path: '/settings/ai/telegram',
    name: 'telegram-settings',
    component: () => import('@/views/settings/AI/TelegramSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/settings/ai/email',
    name: 'email-settings',
    component: () => import('@/views/settings/AI/EmailSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'settings-ai', permissionFallback: 'settings-ai' },
  },
  {
    path: '/content',
    name: 'content-list',
    meta: { closeFallback: 'crm' },
    component: () => import('../views/content/ContentListView.vue'),
  },
  {
    path: '/content/media',
    name: 'content-media',
    component: () => import('../views/content/ContentMediaLibraryView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-list', permissionFallback: 'content-list' },
  },
  {
    path: '/content/store',
    name: 'content-store',
    component: () => import('../views/content/StoreCatalogEditorView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'crm', permissionFallback: 'crm-store' },
  },
  {
    path: '/content/store/settings',
    name: 'content-store-settings',
    component: () => import('../views/content/StoreSettingsView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'crm', permissionFallback: 'crm-store' },
  },
  {
    path: '/content/store/sections',
    name: 'content-store-sections',
    component: () => import('../views/content/StoreSectionsManageView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-store', permissionFallback: 'content-list' },
  },
  {
    path: '/content/store/sections/new',
    name: 'content-store-section-new',
    component: () => import('../views/content/StoreSectionEditView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-store-sections', permissionFallback: 'content-list' },
  },
  {
    path: '/content/store/sections/:id',
    name: 'content-store-section-edit',
    component: () => import('../views/content/StoreSectionEditView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-store-sections', permissionFallback: 'content-list' },
  },
  {
    path: '/content/store/product/new',
    name: 'content-store-product-new',
    component: () => import('../views/content/StoreProductEditView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-store', permissionFallback: 'content-list' },
  },
  {
    path: '/content/store/product/:id',
    name: 'content-store-product-edit',
    component: () => import('../views/content/StoreProductEditView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_LEGAL_DOCS, closeFallback: 'content-store', permissionFallback: 'content-list' },
  },
  {
    path: '/crm/store',
    name: 'crm-store',
    component: () => import('../views/crm/StoreOrdersView.vue'),
    meta: { permission: PERMISSIONS.VIEW_CRM, closeFallback: 'crm', permissionFallback: 'crm' },
  },
  {
    path: '/store',
    name: 'storefront',
    component: () => import('../views/store/StorefrontView.vue'),
    meta: { closeFallback: 'home' },
  },
  {
    path: '/store/cart',
    name: 'store-cart',
    component: () => import('../views/store/StoreCartView.vue'),
    meta: { closeFallback: 'storefront' },
  },
  {
    path: '/store/pay/:id',
    name: 'store-pay',
    component: () => import('../views/store/StorePayView.vue'),
    meta: { closeFallback: 'store-cart' },
  },
  {
    path: '/store/s/:slug',
    name: 'store-section',
    component: () => import('../views/store/StorefrontView.vue'),
    props: true,
    meta: { closeFallback: 'storefront' },
  },
  {
    path: '/store/:id',
    name: 'store-product',
    component: () => import('../views/store/StoreProductView.vue'),
    meta: { closeFallback: 'storefront' },
  },
  {
    path: '/content/templates',
    name: 'content-templates',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/TemplatesListView.vue'),
  },
  {
    path: '/content/published',
    name: 'content-published',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/PublishedListView.vue'),
  },
  {
    path: '/content/published/:slug',
    name: 'content-published-slug',
    meta: { closeFallback: 'content-published' },
    component: () => import('../views/content/PublishedPageView.vue'),
  },
  {
    path: '/content/internal',
    name: 'content-internal',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/InternalListView.vue'),
  },
  {
    path: '/content/create',
    name: 'content-create',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/ContentPageView.vue'),
  },
  {
    path: '/content/settings',
    name: 'content-settings',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/ContentSettingsView.vue'),
  },
  {
    path: '/content/system-messages/table',
    name: 'content-system-messages-table',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/system-messages/SystemMessagesTableView.vue'),
  },
  {
    path: '/content/page/:id',
    name: 'page-view',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/PageView.vue'),
  },
  {
    path: '/public/page/:id',
    name: 'public-page-view',
    meta: { closeFallback: 'content-list' },
    component: () => import('../views/content/PublicPageView.vue'),
  },
  {
    path: '/management',
    name: 'management',
    meta: { closeFallback: 'home' },
    component: () => import('../views/ManagementView.vue')
  },
  {
    path: '/management/dle',
    name: 'management-dle',
    meta: { closeFallback: 'management' },
    component: () => import('../views/smartcontracts/DleManagementView.vue')
  },
  {
    path: '/management/dle-management',
    redirect: { name: 'management-dle' },
  },
  {
    path: '/management/dle-blocks',
    name: 'management-dle-blocks',
    meta: { closeFallback: 'management' },
    component: () => import('../views/smartcontracts/DleBlocksManagementView.vue')
  },
  {
    path: '/management/proposals',
    name: 'management-proposals',
    meta: { closeFallback: 'management-dle-blocks' },
    component: () => import('../views/smartcontracts/DleProposalsView.vue')
  },
  {
    path: '/management/create-proposal',
    name: 'management-create-proposal',
    meta: { closeFallback: 'management-dle-blocks' },
    component: () => import('../views/smartcontracts/CreateProposalView.vue')
  },
  {
    path: '/management/add-module',
    name: 'management-add-module',
    component: () => import('../views/smartcontracts/AddModuleFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/transfer-tokens',
    name: 'management-transfer-tokens',
    component: () => import('../views/smartcontracts/TransferTokensFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/dle-core-op',
    name: 'management-dle-core-op',
    component: () => import('../views/smartcontracts/DleCoreOpFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/remove-module',
    name: 'management-remove-module',
    component: () => import('../views/smartcontracts/RemoveModuleFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/module-bridge-op',
    name: 'management-module-bridge-op',
    component: () => import('../views/smartcontracts/ModuleBridgeOpFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/treasury-bridge-op',
    name: 'management-treasury-bridge-op',
    component: () => import('../views/smartcontracts/TreasuryBridgeOpFormView.vue'),
    meta: { permission: PERMISSIONS.GOVERNANCE_PROPOSAL, permissionFallback: 'management-create-proposal', closeFallback: 'management-create-proposal' },
  },
  {
    path: '/management/modules',
    name: 'management-modules',
    meta: { closeFallback: 'management-dle-blocks' },
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
    meta: { closeFallback: 'management-dle-blocks' },
    component: () => import('../views/smartcontracts/AnalyticsView.vue')
  },
  {
    path: '/management/history',
    name: 'management-history',
    meta: { closeFallback: 'management-dle-blocks' },
    component: () => import('../views/smartcontracts/HistoryView.vue')
  },
  {
    path: '/management/settings',
    name: 'management-settings',
    meta: { closeFallback: 'management-dle-blocks' },
    component: () => import('../views/smartcontracts/SettingsView.vue')
  },
  {
    path: '/vds',
    name: 'vds-management',
    component: () => import('../views/VdsManagementView.vue'),
    meta: { permission: PERMISSIONS.MANAGE_SETTINGS, closeFallback: 'management' }
  },
  {
    path: '/connect-wallet',
    name: 'connect-wallet',
    component: () => import('../views/ConnectWalletView.vue')
  },
  {
    path: '/conference/join',
    name: 'conference-join',
    component: () => import('../views/ConferenceJoinView.vue')
  },
  {
    path: '/conference/live/:sessionId',
    name: 'conference-participant-live',
    component: () => import('../views/contacts/ConferenceLiveView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/groups',
    name: 'groups',
    meta: { closeFallback: 'crm' },
    component: () => import('../views/groups/GroupsView.vue')
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function isOwnContactScreen(to, meOverride) {
  const id = to.params?.id;
  const me = meOverride ?? sessionUserId?.value;
  if (me == null || id == null || id === 'new') return false;
  if (String(id).startsWith('guest_')) return false;
  if (String(id) !== String(me)) return false;
  return to.name === 'contact-details'
    || to.name === 'contact-profile'
    || to.name === 'contact-orders'
    || to.name === 'contact-cart'
    || to.name === 'contact-conference'
    || to.name === 'contact-conference-live';
}

/** Главная `/` — только для гостя; вошедший → своя карточка. */
function ownContactDetailsRoute(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return { name: 'contact-details', params: { id: String(id) } };
}

// console.log('router/index.js: Router created');

// Защита маршрутов — meta.permission / meta.requiresAuth + матрица экранов по роли
router.beforeEach(async (to, from, next) => {
  if (!to.matched.length) {
    return next({ name: 'home' });
  }

  const requiredPermission = to.meta?.permission;
  const requiresAuth = to.meta?.requiresAuth;
  const editorOnly = to.matched.some((r) => r.meta?.editorOnly);

  try {
    // Вошедший на `/` → личный чат/карточка (сайдбар «Чат» ведёт туда же)
    if (to.name === 'home') {
      const dest = ownContactDetailsRoute(sessionUserId?.value);
      if (dest) return next(dest);
    }

    await ensureScreenAccessLoaded();
    await ensureActionAccessLoaded();
    if (!canAccessPath(to.path)) {
      console.log('[Router] Экран скрыт матрицей ролей:', to.path);
      if (isOwnContactScreen(to, sessionUserId?.value)) {
        return next();
      }
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    if (!requiredPermission && !requiresAuth && !editorOnly) {
      if (to.path.startsWith('/management/')) {
        const response = await axios.get('/auth/check');
        if (response.data?.authenticated && response.data.userAccessLevel) {
          const role = response.data.userAccessLevel.level;
          if (role === 'readonly' || role === 'editor' || role === 'user') {
            await syncActionAccessRole(role);
          }
        }
      }
      return next();
    }

    const response = await axios.get('/auth/check');
    const authData = response.data;

    if (!authData.authenticated) {
      console.log('[Router] Доступ запрещен: требуется авторизация для', to.path);
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    const userAccessLevel = authData.userAccessLevel;
    let userRole = 'user';
    if (userAccessLevel?.level === 'readonly') {
      userRole = 'readonly';
    } else if (userAccessLevel?.level === 'editor') {
      userRole = 'editor';
    }

    const screenRole = userRole;
    await syncScreenAccessRole(screenRole);
    await syncActionAccessRole(userRole);

    if (!canAccessPath(to.path)) {
      if (isOwnContactScreen(to, authData.userId ?? sessionUserId?.value)) {
        return next();
      }
      return next({ name: 'home' });
    }

    if (editorOnly && userRole !== 'editor') {
      const contactId = to.params?.id;
      if (contactId) {
        return next({ name: 'contact-conference', params: { id: contactId } });
      }
      return next({ name: 'home' });
    }

    if (isOwnContactScreen(to, authData.userId ?? sessionUserId?.value)) {
      return next();
    }

    if (requiresAuth && !requiredPermission) {
      return next();
    }

    if (!requiredPermission) {
      return next();
    }

    if (!userAccessLevel) {
      console.log('[Router] Доступ запрещен: нет данных об уровне доступа');
      if (to.meta?.permissionFallback) {
        return next({ name: to.meta.permissionFallback });
      }
      return next({ name: 'home' });
    }

    if (!hasActionAccess(requiredPermission)) {
      const level = userAccessLevel?.level;
      const governanceFallback =
        requiredPermission === PERMISSIONS.GOVERNANCE_PROPOSAL
        && userAccessLevel?.hasAccess
        && (level === 'readonly' || level === 'editor');
      if (!governanceFallback) {
        console.log(`[Router] Доступ запрещен: роль ${userRole} не имеет права ${requiredPermission}`);
        if (to.meta?.permissionFallback) {
          return next({ name: to.meta.permissionFallback });
        }
        return next({ name: 'home' });
      }
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
