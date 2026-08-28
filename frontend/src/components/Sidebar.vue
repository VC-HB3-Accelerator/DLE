<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <transition name="sidebar-slide">
    <div v-if="modelValue" class="wallet-sidebar">
      <div class="wallet-sidebar-content">
        <!-- Блок для неавторизованных пользователей -->
        <div v-if="!isAuthenticated">
          <div
            v-if="
              !telegramAuth?.showVerification &&
              !emailAuth?.showForm &&
              !emailAuth?.showVerification &&
              !passwordAuth?.showStub
            "
            class="button-with-close"
          >
            <button
              type="button"
              class="btn btn-primary connect-wallet-btn"
              @click="onGuestConnect"
            >
              {{ t('auth.connect') }}
            </button>
            <div v-if="showAuthPicker" class="auth-type-picker" ref="authPickerRoot">
              <button
                type="button"
                class="btn btn-outline btn-icon auth-type-picker__trigger"
                :aria-label="t('auth.authTypePicker')"
                :title="t('auth.authTypePicker')"
                @click.stop="authPickerOpen = !authPickerOpen"
              >
                <UiGlyph :name="selectedAuthGlyph" :size="18" />
                <UiGlyph name="chevron-down" :size="12" />
              </button>
              <ul v-if="authPickerOpen" class="auth-type-picker__menu" role="listbox">
                <li
                  v-for="opt in enabledAuthOptions"
                  :key="opt.id"
                  role="option"
                  :aria-selected="selectedAuthType === opt.id"
                  :aria-label="opt.label"
                  :title="opt.label"
                  :class="{ 'is-active': selectedAuthType === opt.id }"
                  @click="selectAuthType(opt.id)"
                >
                  <UiGlyph :name="opt.glyph" :size="18" />
                </li>
              </ul>
            </div>
            <button type="button" class="btn btn-outline btn-icon close-sidebar-btn" @click="closeSidebar">×</button>
          </div>
          <div v-else class="button-with-close">
            <button type="button" class="btn btn-outline btn-icon close-sidebar-btn" @click="closeSidebar">×</button>
          </div>

          <div v-if="telegramAuth?.showVerification" class="auth-modal-panel">
            <TelegramConnect
              :bot-link="telegramAuth?.botLink"
              :error="telegramAuth?.error"
              :is-loading="telegramAuth?.isLoading"
              @cancel="$emit('cancel-telegram-auth')"
              @request-link="$emit('confirm-telegram-deeplink')"
            />
          </div>
          <div v-else-if="emailAuth && (emailAuth.showForm || emailAuth.showVerification)" class="auth-modal-panel">
            <EmailConnect @success="$emit('cancel-email-auth')">
              <template #actions>
                <button type="button" class="btn btn-outline" @click="$emit('cancel-email-auth')">{{ t('auth.cancel') }}</button>
              </template>
            </EmailConnect>
          </div>
          <div v-else-if="passwordAuth?.showStub" class="auth-modal-panel password-stub-panel">
            <p>{{ t('auth.passwordComingSoon') }}</p>
            <button type="button" class="btn btn-outline" @click="$emit('cancel-password-auth')">{{ t('auth.cancel') }}</button>
          </div>
        </div>

        <!-- Блок для авторизованных пользователей -->
        <div v-if="isAuthenticated">
          <div class="button-with-close">
            <button type="button" class="btn btn-ghost disconnect-wallet-btn" @click="disconnectWallet">
              {{ t('auth.disconnect') }}
            </button>
            <button type="button" class="btn btn-outline btn-icon close-sidebar-btn" @click="closeSidebar">×</button>
          </div>
        </div>

        <!-- Язык и локации -->
        <LocaleControls />

        <!-- Навигационные кнопки -->
        <div class="navigation-buttons">
          <router-link
            v-if="canAccessPath('/')"
            to="/"
            class="btn btn-ghost btn-block nav-link-btn"
            active-class="active"
          >
            <span>{{ t('nav.chat') }}</span>
          </router-link>
          <router-link
            v-if="canAccessPath('/blog')"
            to="/blog"
            class="btn btn-ghost btn-block nav-link-btn"
            active-class="active"
          >
            <span>{{ t('nav.blog') }}</span>
          </router-link>
          <router-link
            v-if="canAccessPath('/management')"
            to="/management"
            class="btn btn-ghost btn-block nav-link-btn"
            active-class="active"
          >
            <span>{{ t('nav.management') }}</span>
          </router-link>
          <a
            v-if="showRepositories"
            :href="giteaUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-ghost btn-block nav-link-btn"
            @click="closeSidebar"
          >
            <span>{{ t('nav.repositories') }}</span>
          </a>
          <router-link
            v-if="showStore && canAccessPath('/store')"
            to="/store"
            class="btn btn-ghost btn-block nav-link-btn"
            active-class="active"
            @click="closeSidebar"
          >
            <span>{{ t('nav.store') }}</span>
          </router-link>
        </div>

        <!-- Текст редактора + Политика и согласия -->
        <div class="sidebar-notice">
          <p v-if="sidebarNoticeText" class="sidebar-notice__text">{{ sidebarNoticeText }}</p>
          <a
            class="sidebar-notice__privacy"
            :href="privacyDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click="closeSidebar"
          >
            {{ t('settings.sidebarNotice.privacyLink') }}
          </a>
        </div>
        
        <!-- Блок информации о пользователе или формы подключения -->
        <template v-if="isAuthenticated">
          <div v-if="emailAuth && (emailAuth.showForm || emailAuth.showVerification)" class="auth-modal-panel">
            <EmailConnect @success="$emit('cancel-email-auth')">
              <template #actions>
                <button type="button" class="btn btn-outline" @click="$emit('cancel-email-auth')">{{ t('auth.cancel') }}</button>
              </template>
            </EmailConnect>
          </div>
          <div v-else-if="telegramAuth && telegramAuth.showVerification" class="auth-modal-panel">
            <TelegramConnect
              :bot-link="telegramAuth?.botLink"
              :error="telegramAuth?.error"
              :is-loading="telegramAuth?.isLoading"
              @cancel="$emit('cancel-telegram-auth')"
              @request-link="$emit('confirm-telegram-deeplink')"
            />
          </div>
          <div v-else-if="passwordAuth?.showStub" class="auth-modal-panel password-stub-panel">
            <p>{{ t('auth.passwordComingSoon') }}</p>
            <button type="button" class="btn btn-outline" @click="$emit('cancel-password-auth')">{{ t('auth.cancel') }}</button>
          </div>
          <div v-else class="user-info-section sidebar-section">
            <h3>{{ t('auth.yourIdentifiers') }}</h3>
            <div class="user-info-item">
              <span class="user-info-label">{{ t('auth.wallet') }}</span>
              <span v-if="hasIdentityType('wallet')" class="user-info-value">
                <span class="user-info-text">{{ truncateAddress(getIdentityValue('wallet')) }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="handleDeleteIdentity('wallet', getIdentityValue('wallet'))">{{ t('auth.delete') }}</button>
              </span>
              <span v-else class="user-info-value">
                <span class="user-info-text">{{ t('auth.notConnected') }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="handleWalletAuth">{{ t('auth.connect') }}</button>
              </span>
            </div>
            <div class="user-info-item">
              <span class="user-info-label">{{ t('auth.telegram') }}</span>
              <span v-if="hasIdentityType('telegram')" class="user-info-value">
                <span class="user-info-text">{{ getIdentityValue('telegram') }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="handleDeleteIdentity('telegram', getIdentityValue('telegram'))">{{ t('auth.delete') }}</button>
              </span>
              <span v-else class="user-info-value">
                <span class="user-info-text">{{ t('auth.notConnected') }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="$emit('telegram-auth')">{{ t('auth.connect') }}</button>
              </span>
            </div>
            <div class="user-info-item">
              <span class="user-info-label">{{ t('auth.email') }}</span>
              <span v-if="hasIdentityType('email')" class="user-info-value">
                <span class="user-info-text">{{ getIdentityValue('email') }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="handleDeleteIdentity('email', getIdentityValue('email'))">{{ t('auth.delete') }}</button>
              </span>
              <span v-else class="user-info-value">
                <span class="user-info-text">{{ t('auth.notConnected') }}</span>
                <button type="button" class="btn btn-sm btn-outline connect-btn" @click="$emit('email-auth')">{{ t('auth.connect') }}</button>
              </span>
            </div>
          </div>
        </template>

        <!-- Блок баланса токенов -->
        <div v-if="isAuthenticated" class="token-balances-section sidebar-section">
          <h3>{{ t('nav.tokenBalance') }}</h3>
          <div v-if="isLoadingTokens" class="token-loading">
            {{ t('nav.loadingTokenBalances') }}
          </div>
          <div v-else-if="!tokenBalances || tokenBalances.length === 0" class="token-no-data">
            {{ t('nav.tokenBalanceUnavailable') }}
          </div>
          <div v-else>

            <div v-for="(token, index) in tokenBalances" :key="token.tokenAddress ? token.tokenAddress : 'token-' + index" class="token-balance-row" :class="{ 'token-error': token.error }">
              <span class="token-name">{{ token.tokenName }}</span>
              <span class="token-network">{{ token.network }}</span>
              <span v-if="token.error" class="token-error-message" :title="token.errorDetails">
                {{ token.error }}
              </span>
              <span v-else class="token-amount">{{ isNaN(Number(token.balance)) ? '—' : Number(token.balance).toLocaleString() }}</span>
            </div>
          </div>
        </div>

        <!-- Блок с информацией об авторских правах -->
        <div class="copyright-section">
          <p class="copyright-text">
            © Тарабанов А. В. · {{ t('common.allRightsReserved') }}
            <a
              href="https://github.com/VC-HB3-Accelerator"
              target="_blank"
              rel="noopener noreferrer"
              class="copyright-link"
              title="GitHub"
            >GitHub</a>
          </p>
        </div>

      </div>
    </div>
  </transition>
</template>

<script setup>
import { defineProps, defineEmits, ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import eventBus from '../utils/eventBus';
import EmailConnect from './identity/EmailConnect.vue';
import TelegramConnect from './identity/TelegramConnect.vue';
import LocaleControls from './LocaleControls.vue';
import UiGlyph from './UiGlyph.vue';
import { useAuthContext } from '@/composables/useAuth';
import { useI18n } from 'vue-i18n';
import { fetchSidebarNotice } from '@/services/sidebarNoticeService';
import { fetchSidebarNav } from '@/services/sidebarNavService';
import { getPrivacyDocsUrl } from '@/constants/publishedDocs';
import { getSidebarAuthMethodsCache } from '@/config/sidebarAuthMethodsCache';
import {
  canAccessPath,
  ensureScreenAccessLoaded,
  invalidateScreenAccess
} from '@/composables/useScreenAccess.js';

const props = defineProps({
  modelValue: Boolean,
  isAuthenticated: Boolean,
  telegramAuth: Object,
  emailAuth: Object,
  passwordAuth: Object,
  tokenBalances: Array,
  identities: Array,
  isLoadingTokens: Boolean,
  formattedLastUpdate: String,
});

const emit = defineEmits([
  'update:modelValue',
  'wallet-auth',
  'disconnect-wallet',
  'telegram-auth',
  'email-auth',
  'password-auth',
  'cancel-email-auth',
  'cancel-telegram-auth',
  'confirm-telegram-deeplink',
  'cancel-password-auth',
]);

const { t } = useI18n();
const { deleteIdentity, updateIdentities } = useAuthContext();
const sidebarNoticeText = ref('');
const showRepositories = ref(false);
const showStore = ref(false);
const privacyDocsUrl = getPrivacyDocsUrl();
const authMethodsCache = getSidebarAuthMethodsCache();
const authMethods = computed(() => authMethodsCache.methods);
const selectedAuthType = ref('wallet');
const authPickerOpen = ref(false);
const authPickerRoot = ref(null);

const enabledAuthOptions = computed(() => {
  const all = [
    { id: 'wallet', glyph: 'wallet', label: t('auth.authTypeWallet') },
    { id: 'telegram', glyph: 'telegram', label: t('auth.authTypeTelegram') },
    { id: 'email', glyph: 'at', label: t('auth.authTypeEmail') },
    { id: 'password', glyph: 'lock', label: t('auth.authTypePassword') },
  ];
  return all.filter((opt) => Boolean(authMethods.value[opt.id]));
});

const showAuthPicker = computed(() => enabledAuthOptions.value.length > 1);

const selectedAuthGlyph = computed(() => {
  const found = enabledAuthOptions.value.find((o) => o.id === selectedAuthType.value);
  return found?.glyph || 'wallet';
});

function selectAuthType(id) {
  selectedAuthType.value = id;
  authPickerOpen.value = false;
}

function onGuestConnect() {
  const type = selectedAuthType.value;
  if (type === 'telegram') emit('telegram-auth');
  else if (type === 'email') emit('email-auth');
  else if (type === 'password') emit('password-auth');
  else emit('wallet-auth');
}

function onDocClick(event) {
  if (!authPickerRoot.value) return;
  if (!authPickerRoot.value.contains(event.target)) {
    authPickerOpen.value = false;
  }
}

async function loadSidebarNotice() {
  try {
    const data = await fetchSidebarNotice();
    sidebarNoticeText.value = String(data?.body || '').trim();
  } catch (error) {
    console.warn('[Sidebar] sidebar notice load failed:', error);
    sidebarNoticeText.value = '';
  }
}

async function loadSidebarNav() {
  try {
    const data = await fetchSidebarNav();
    showRepositories.value = Boolean(data?.buttons?.repositories);
    showStore.value = Boolean(data?.buttons?.store);
    // authMethods обновляет реактивный кеш в fetchSidebarNav
    if (!authMethods.value[selectedAuthType.value]) {
      selectedAuthType.value = 'wallet';
    }
  } catch (error) {
    console.warn('[Sidebar] sidebar nav load failed:', error);
    showRepositories.value = false;
    showStore.value = false;
  }
}

async function loadSidebarExtras() {
  await Promise.all([loadSidebarNotice(), loadSidebarNav()]);
}

const giteaUrl = computed(() => {
  if (typeof window === 'undefined') return '#';
  const { hostname, protocol } = window.location;
  const path = 'VC-HB3-Accelerator';
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  if (isLocal) {
    const port = import.meta.env.VITE_GITEA_PORT || '3001';
    return `${protocol}//${hostname}:${port}/${path}`;
  }
  return `${protocol}//${hostname}/gitea/${path}`;
});

onMounted(() => {
  loadSidebarExtras();
  ensureScreenAccessLoaded();
  document.addEventListener('click', onDocClick);
  window.addEventListener('clear-application-data', () => {
    console.log('[Sidebar] Clearing sidebar data');
    invalidateScreenAccess();
  });
  window.addEventListener('refresh-application-data', () => {
    console.log('[Sidebar] Refreshing sidebar data');
    loadSidebarExtras();
    invalidateScreenAccess();
    ensureScreenAccessLoaded(true);
  });
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
});

watch(
  () => props.modelValue,
  (open) => {
    if (open) loadSidebarExtras();
  }
);

const handleWalletAuth = () => {
  emit('wallet-auth');
};

const disconnectWallet = () => {
  emit('disconnect-wallet');
};

const closeSidebar = () => {
  emit('update:modelValue', false);
};

const handleAuthEvent = () => {
  invalidateScreenAccess();
  ensureScreenAccessLoaded(true);
};

let unsubscribe = null;
let unsubscribeNav = null;
onMounted(() => {
  unsubscribe = eventBus.on('auth-state-changed', handleAuthEvent);
  unsubscribeNav = eventBus.on('sidebar-nav-saved', (data) => {
    if (data?.buttons) {
      showRepositories.value = Boolean(data.buttons.repositories);
      showStore.value = Boolean(data.buttons.store);
    }
    if (!authMethods.value[selectedAuthType.value]) {
      selectedAuthType.value = 'wallet';
    }
  });
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
  if (unsubscribeNav) unsubscribeNav();
});

const truncateAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

const hasIdentityType = (type) => {
  if (!props.identities) return false;
  return props.identities.some((identity) => identity.provider === type);
};

const getIdentityValue = (type) => {
  if (!props.identities) return null;
  const identity = props.identities.find((identity) => identity.provider === type);
  return identity ? identity.provider_id : null;
};

const handleDeleteIdentity = async (provider, providerId) => {
  if (!confirm(t('auth.confirmDeleteIdentity'))) return;
  try {
    await deleteIdentity(provider, providerId);
    await updateIdentities();
  } catch (err) {
    const msg =
      err?.response?.data?.error ||
      err?.message ||
      t('auth.deleteIdentityFailed');
    window.alert(msg);
  }
};
</script>

<style scoped>
.wallet-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  background-color: var(--color-white);
  z-index: 1000;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--spacing-lg);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  transition: transform var(--transition-normal), opacity var(--transition-normal);
  box-shadow: -5px 0 15px rgba(0, 0, 0, 0.1);
}

.wallet-sidebar-content {
  max-width: 100%;
  width: 100%;
  margin: 0 auto;
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* Анимация появления и исчезновения правой панели */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: all var(--transition-normal);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.button-with-close {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.connect-wallet-btn,
.disconnect-wallet-btn {
  flex: 1;
}

.auth-type-picker {
  position: relative;
  flex-shrink: 0;
}

.auth-type-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  min-width: 2.75rem;
}

.auth-type-picker__menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 40;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  background: var(--color-white, #fff);
  border: 1px solid var(--color-grey-light, #dee2e6);
  border-radius: var(--radius-sm, 6px);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12));
}

.auth-type-picker__menu li {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
}

.auth-type-picker__menu li:hover,
.auth-type-picker__menu li.is-active {
  background: var(--color-grey-light, #f1f3f5);
}

.password-stub-panel p {
  margin: 0 0 0.75rem;
  line-height: 1.4;
}

/* Единое выравнивание текста кнопок сайдбара — слева (как список) */
.wallet-sidebar :deep(.btn:not(.btn-icon)),
.wallet-sidebar .nav-link-btn,
.wallet-sidebar .connect-wallet-btn,
.wallet-sidebar .disconnect-wallet-btn {
  justify-content: flex-start;
  text-align: left;
  padding-left: var(--spacing-md);
  padding-right: var(--spacing-md);
}

.wallet-sidebar :deep(.btn-icon),
.wallet-sidebar .close-sidebar-btn {
  justify-content: center;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}

/* Навигация: active поверх .btn-ghost */
.navigation-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.nav-link-btn.active {
  background-color: var(--color-grey-light);
  border-color: var(--color-grey);
  font-weight: 600;
}

.sidebar-notice {
  margin-top: 12px;
  padding: 0;
}

.sidebar-notice__text {
  margin: 0 0 4px;
  line-height: 1.35;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-light);
  white-space: pre-wrap;
  word-break: break-word;
}

.sidebar-notice__privacy {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-light);
  text-decoration: none;
  opacity: 0.85;
  transition: color var(--transition-fast), opacity var(--transition-fast);
}

.sidebar-notice__privacy:hover {
  color: var(--color-grey);
  opacity: 1;
  text-decoration: underline;
}

/* Секции сайдбара */
.sidebar-section {
  background-color: var(--color-light);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-lg);
}

h3 {
  color: var(--color-dark);
  margin-bottom: var(--spacing-md);
  font-size: var(--font-size-md);
}

.token-balance,
.user-info-item {
  display: flex;
  align-items: center;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-sm);
}

.user-info-item {
  width: 100%;
  gap: var(--spacing-sm);
  min-width: 0;
}

.user-info-value {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  min-width: 0;
}

.user-info-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-name,
.user-info-label {
  font-weight: bold;
  width: 80px;
  flex-shrink: 0;
}

.token-amount {
  flex: 1;
}

.token-no-data,
.user-info-empty {
  color: var(--color-text-light);
  font-style: italic;
  font-size: var(--font-size-sm);
}

/* Добавляем стиль для индикатора загрузки */
.token-loading {
  color: var(--color-text-light);
  font-style: italic;
  font-size: var(--font-size-sm);
}

/* Стили для ошибок токенов */
.token-balance-row.token-error {
  background-color: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs);
}

.token-error-message {
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  font-weight: bold;
  flex: 1;
  cursor: help;
}

/* bp: desktop ≥1200 (= 1199+1), tablet ≤1199, mobile ≤768/480/360 */
@media (min-width: 1200px) {
  .wallet-sidebar {
    width: var(--sidebar-panel-width);
    max-width: var(--sidebar-panel-width);
  }
}

@media (min-width: 769px) and (max-width: 1199px) {
  .wallet-sidebar {
    width: var(--sidebar-panel-width-narrow);
    max-width: var(--sidebar-panel-width-narrow);
  }
}

@media (max-width: 768px) {
  .wallet-sidebar {
    padding: var(--spacing-md);
  }

  .wallet-sidebar-content {
    padding: 0;
    gap: var(--spacing-md);
  }
}

.token-balance-header {
  display: flex;
  font-weight: bold;
  color: var(--color-dark);
  gap: var(--spacing-sm);
  margin-bottom: 6px;
}
.token-balance-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  margin-bottom: 4px;
}
.token-name {
  min-width: 80px;
  font-weight: 500;
}
.token-network {
  min-width: 70px;
  color: var(--color-dark);
}
.token-amount {
  min-width: 80px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.connect-btn {
  margin-left: 0;
  flex-shrink: 0;
  min-width: 7.5rem;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.wallet-sidebar .connect-btn.btn {
  justify-content: center;
  text-align: center;
}

.auth-modal-panel {
  background: var(--color-white);
  border-radius: var(--block-radius);
  box-shadow: var(--shadow-md);
  padding: var(--block-padding);
  max-width: min(400px, 100%);
  width: 100%;
  margin: var(--spacing-lg) auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  box-sizing: border-box;
}

.copyright-section {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-grey-light);
}

.copyright-text {
  margin: 0;
  line-height: 1.35;
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-light);
}

.copyright-link {
  color: inherit;
  text-decoration: none;
  margin-left: 0.35rem;
  opacity: 0.85;
  transition: color var(--transition-fast), opacity var(--transition-fast);
}

.copyright-link:hover {
  color: var(--color-grey);
  opacity: 1;
  text-decoration: underline;
}

@media (max-width: 768px) {
  .copyright-section {
    margin-top: 0.75rem;
    padding-top: 0.5rem;
  }

  .auth-modal-panel {
    padding: var(--block-padding-mobile);
    margin: var(--spacing-md) auto;
  }
}
</style> 