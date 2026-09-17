/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Вторая страница личного сайдбара: разделы выбранной карточки CRM + Закрыть.
 * База: Чат / Профиль / Лента / Магазин.
 * Контакты / Звонки / Таблицы — editor|Boss@ (domain) или своя карточка.
 * TZ_PERSONAL_SIDEBAR_CRM_CARD.ru.md + TZ_PROFILE_OWNED_DATA.ru.md
 */

import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import { canAccessPath, ensureScreenAccessLoaded } from '@/composables/useScreenAccess.js';

const CARD_ROUTE_NAMES = new Set([
  'contact-details',
  'contact-profile',
  'contact-media',
  'contact-orders',
  'contact-cart',
  'contact-conference',
  'contact-conference-agent',
  'contact-conference-live',
]);

/** Маршруты с ?owner=:id, сохраняющие контекст стр. 2 */
const OWNER_CONTEXT_ROUTE_NAMES = new Set([
  'blog',
  'blog-article',
  'storefront',
  'store-product',
  'contacts-list',
  'tables-list',
]);

function parseContactId(raw) {
  if (raw == null || raw === '' || raw === 'new') return null;
  if (typeof raw === 'string' && raw.startsWith('guest_')) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function usePersonalSidebarCard() {
  const route = useRoute();
  const router = useRouter();
  const { userId: sessionUserId, isAuthenticated, userAccessLevel } = useAuthContext();

  ensureScreenAccessLoaded();

  const dataScope = computed(() => {
    const scope = userAccessLevel.value?.dataScope;
    if (scope === 'global' || scope === 'domain' || scope === 'own' || scope === 'none') {
      return scope;
    }
    return isAuthenticated.value ? 'own' : 'none';
  });

  const ownContactId = computed(() => parseContactId(sessionUserId.value));

  const isCardRoute = computed(() => CARD_ROUTE_NAMES.has(String(route.name || '')));

  const isOwnerContextRoute = computed(() => (
    OWNER_CONTEXT_ROUTE_NAMES.has(String(route.name || ''))
  ));

  /**
   * Выбранный контакт: params.id на карточке CRM
   * или query.owner на ленте/магазине/контактах/таблицах профиля.
   */
  const selectedContactId = computed(() => {
    if (isCardRoute.value) {
      return parseContactId(route.params.id);
    }
    if (isOwnerContextRoute.value) {
      return parseContactId(route.query.owner);
    }
    return null;
  });

  const isOwnCard = computed(() => (
    ownContactId.value != null
    && selectedContactId.value != null
    && String(ownContactId.value) === String(selectedContactId.value)
  ));

  /** Страница 2 только для чужого контакта (CRM или его owner-контекст). */
  const showCardPage = computed(() => (
    Boolean(isAuthenticated.value)
    && selectedContactId.value != null
    && !isOwnCard.value
    && (isCardRoute.value || isOwnerContextRoute.value)
  ));

  const isRegisteredContact = computed(() => selectedContactId.value != null);

  /** Контакты / таблицы / звонки профиля — не для own на чужой карточке. */
  const canShowProfileOwnedExtras = computed(() => (
    isOwnCard.value
    || dataScope.value === 'global'
    || dataScope.value === 'domain'
  ));

  const canShowConference = computed(() => {
    if (!isRegisteredContact.value) return false;
    if (!canShowProfileOwnedExtras.value) return false;
    const id = selectedContactId.value;
    if (!canAccessPath(`/contacts/${id}/conference`)) return false;
    if (isOwnCard.value) return true;
    return dataScope.value === 'domain' || dataScope.value === 'global';
  });

  function cardTarget(name) {
    const id = selectedContactId.value;
    if (!id) return { name: 'contacts-list' };
    const query = {};
    if (route.query.broadcastCampaignId) {
      query.broadcastCampaignId = route.query.broadcastCampaignId;
    }
    return {
      name,
      params: { id: String(id) },
      query,
    };
  }

  function ownerQueryTarget(name) {
    const id = selectedContactId.value;
    if (!id) return { name };
    return { name, query: { owner: String(id) } };
  }

  function isCardNavActive(name) {
    if (name === 'contact-conference') {
      return (
        route.name === 'contact-conference'
        || route.name === 'contact-conference-agent'
        || route.name === 'contact-conference-live'
      );
    }
    return route.name === name;
  }

  function isOwnerQueryActive(routeNames) {
    const names = Array.isArray(routeNames) ? routeNames : [routeNames];
    if (!names.includes(route.name)) return false;
    return String(route.query.owner || '') === String(selectedContactId.value);
  }

  const cardItems = computed(() => {
    if (!showCardPage.value || !selectedContactId.value) return [];

    const items = [
      {
        id: 'card-chat',
        labelKey: 'contacts.details.nav.chat',
        to: cardTarget('contact-details'),
        active: isCardNavActive('contact-details'),
      },
      {
        id: 'card-profile',
        labelKey: 'contacts.details.nav.profile',
        to: cardTarget('contact-profile'),
        active: isCardNavActive('contact-profile'),
      },
    ];

    if (canShowProfileOwnedExtras.value && canAccessPath('/contacts-list')) {
      items.push({
        id: 'card-contacts',
        labelKey: 'personalSidebar.contacts',
        to: ownerQueryTarget('contacts-list'),
        active: isOwnerQueryActive('contacts-list'),
      });
    }

    if (canAccessPath('/blog')) {
      items.push({
        id: 'card-feed',
        labelKey: 'personalSidebar.feed',
        to: ownerQueryTarget('blog'),
        active: isOwnerQueryActive(['blog', 'blog-article']),
      });
    }

    if (canAccessPath('/store')) {
      items.push({
        id: 'card-store',
        labelKey: 'personalSidebar.store',
        to: ownerQueryTarget('storefront'),
        active: isOwnerQueryActive(['storefront', 'store-product']),
      });
    }

    if (canShowProfileOwnedExtras.value) {
      items.push({
        id: 'card-media',
        labelKey: 'personalSidebar.media',
        to: cardTarget('contact-media'),
        active: isCardNavActive('contact-media'),
      });
    }

    if (canShowProfileOwnedExtras.value && canAccessPath('/tables')) {
      items.push({
        id: 'card-tables',
        labelKey: 'personalSidebar.tables',
        to: ownerQueryTarget('tables-list'),
        active: isOwnerQueryActive('tables-list'),
      });
    }

    // Заказы/корзина — внутри Магазина; отдельный пункт в карточке не дублируем.

    if (canShowConference.value) {
      items.push({
        id: 'card-calls',
        labelKey: 'personalSidebar.calls',
        to: cardTarget('contact-conference'),
        active: isCardNavActive('contact-conference'),
      });
    }

    return items;
  });

  async function closeCard() {
    if (canAccessPath('/contacts-list')) {
      await router.push({ name: 'contacts-list' });
      return;
    }
    await router.push({ name: 'home' });
  }

  return {
    dataScope,
    showCardPage,
    selectedContactId,
    isOwnCard,
    cardItems,
    closeCard,
  };
}
