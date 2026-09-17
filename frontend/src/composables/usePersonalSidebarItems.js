/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Пункты личного сайдбара — страница 1 (мой workspace).
 * Страница 2 (карточка CRM) — usePersonalSidebarCard.js.
 * Лента/магазин без ?owner= только при dataScope=global (не isEditor).
 */

import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';
import { usePersonalSidebarCard } from '@/composables/usePersonalSidebarCard';

export function usePersonalSidebarItems() {
  const route = useRoute();
  const { userId: sessionUserId, isAuthenticated, userAccessLevel } = useAuthContext();
  const {
    showCardPage,
    cardItems,
    closeCard,
    dataScope,
    selectedContactId,
  } = usePersonalSidebarCard();

  ensureScreenAccessLoaded();

  const ownContactId = computed(() => {
    if (!isAuthenticated.value) return null;
    const raw = sessionUserId.value;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

  const isGlobalScope = computed(() => dataScope.value === 'global');

  const onOwnCard = computed(() => (
    ownContactId.value != null
    && String(route.params.id) === String(ownContactId.value)
  ));

  function ownContactTarget(name) {
    const id = ownContactId.value;
    if (!id) return { name: 'contacts-list' };
    const query = {};
    if (route.query.broadcastCampaignId && onOwnCard.value) {
      query.broadcastCampaignId = route.query.broadcastCampaignId;
    }
    return {
      name,
      params: { id: String(id) },
      query,
    };
  }

  function isOwnContactNavActive(name) {
    if (!onOwnCard.value) return false;
    if (name === 'contact-conference') {
      return (
        route.name === 'contact-conference'
        || route.name === 'contact-conference-agent'
        || route.name === 'contact-conference-live'
      );
    }
    return route.name === name;
  }

  /** global — без owner; own/domain — свой owner. */
  const ownOwnerQuery = computed(() => {
    if (isGlobalScope.value) return {};
    return ownContactId.value ? { owner: String(ownContactId.value) } : {};
  });

  function isFeedNavActive() {
    if (route.name !== 'blog' && route.name !== 'blog-article') return false;
    if (isGlobalScope.value) return !route.query.owner;
    return String(route.query.owner || '') === String(ownContactId.value);
  }

  function isStoreNavActive() {
    if (route.name !== 'storefront' && route.name !== 'store-product') return false;
    if (isGlobalScope.value) return !route.query.owner;
    return String(route.query.owner || '') === String(ownContactId.value);
  }

  /** Страница 1: стабильный workspace на свою карточку. */
  const workspaceItems = computed(() => {
    if (!isAuthenticated.value || !ownContactId.value) return [];

    const items = [
      {
        id: 'profile',
        labelKey: 'contacts.details.nav.profile',
        to: ownContactTarget('contact-profile'),
        active: isOwnContactNavActive('contact-profile'),
      },
    ];

    if (canAccessPath('/contacts-list')) {
      items.push({
        id: 'contacts',
        labelKey: 'personalSidebar.contacts',
        to: { name: 'contacts-list' },
        active: route.name === 'contacts-list'
          || route.name === 'contacts-import'
          || String(route.name || '').startsWith('contacts-broadcast')
          || route.name === 'contacts-site-parser',
      });
    }

    items.push({
      id: 'chat',
      labelKey: 'contacts.details.nav.chat',
      to: ownContactTarget('contact-details'),
      active: isOwnContactNavActive('contact-details'),
    });

    if (canAccessPath(`/contacts/${ownContactId.value}/conference`)) {
      items.push({
        id: 'calls',
        labelKey: 'personalSidebar.calls',
        to: ownContactTarget('contact-conference'),
        active: isOwnContactNavActive('contact-conference'),
      });
    }

    if (canAccessPath('/blog')) {
      items.push({
        id: 'feed',
        labelKey: 'personalSidebar.feed',
        to: { name: 'blog', query: ownOwnerQuery.value },
        active: isFeedNavActive(),
      });
    }

    if (canAccessPath('/store')) {
      items.push({
        id: 'store',
        labelKey: 'personalSidebar.store',
        to: { name: 'storefront', query: ownOwnerQuery.value },
        active: isStoreNavActive(),
      });
    }

    if (isGlobalScope.value && canAccessPath('/content/media')) {
      items.push({
        id: 'media',
        labelKey: 'personalSidebar.media',
        to: { name: 'content-media' },
        active: route.name === 'content-media',
      });
    } else {
      items.push({
        id: 'media',
        labelKey: 'personalSidebar.media',
        to: ownContactTarget('contact-media'),
        active: isOwnContactNavActive('contact-media'),
      });
    }

    if (canAccessPath('/tables')) {
      const path = String(route.path || '');
      items.push({
        id: 'tables',
        labelKey: 'personalSidebar.tables',
        to: { name: 'tables-list' },
        active: route.name === 'tables-list'
          || path === '/tables'
          || path.startsWith('/tables/'),
      });
    }

    return items;
  });

  /** Совместимость: на карточке — cardItems, иначе workspace. */
  const navItems = computed(() => (
    showCardPage.value ? cardItems.value : workspaceItems.value
  ));

  return {
    isAuthenticated,
    ownContactId,
    userAccessLevel,
    dataScope,
    showCardPage,
    selectedContactId,
    workspaceItems,
    cardItems,
    navItems,
    closeCard,
  };
}
