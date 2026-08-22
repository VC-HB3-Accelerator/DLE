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

import { ref, computed, onMounted, onUnmounted } from 'vue';
import wsClient from '../utils/websocket';
import { i18n } from '@/locales/index.js';
import { useAuth } from './useAuth';

const t = (key, params) => i18n.global.t(key, params);

const tokenBalances = ref([]);
const isLoadingTokens = ref(false);
const lastUpdateTime = ref(null);
let listenersBound = 0;
let autoUpdateInterval = null;

function unwrapWs(msg) {
  if (msg && typeof msg === 'object' && msg.data && typeof msg.data === 'object' && !Array.isArray(msg.data)) {
    return msg.data;
  }
  return msg || {};
}

function applyBalances(list) {
  const auth = useAuth();
  const next = Array.isArray(list) ? list : [];
  tokenBalances.value = next;
  auth.tokenBalances.value = next;
  lastUpdateTime.value = new Date();
  isLoadingTokens.value = false;
}

function requestTokenBalances(address, userId) {
  if (!address) return;

  isLoadingTokens.value = true;

  const sendMessage = () => {
    wsClient.ws.send(JSON.stringify({
      type: 'request_token_balances',
      address,
      userId,
    }));
  };

  if (!wsClient.ws || wsClient.ws.readyState === WebSocket.CLOSED) {
    wsClient.connect();
  }

  if (wsClient.ws.readyState === WebSocket.OPEN) {
    sendMessage();
  } else if (wsClient.ws.readyState === WebSocket.CONNECTING) {
    const onConnected = () => {
      wsClient.off('connected', onConnected);
      sendMessage();
    };
    wsClient.on('connected', onConnected);
  } else {
    isLoadingTokens.value = false;
  }
}

function handleTokenBalancesResponse(msg) {
  applyBalances(unwrapWs(msg).balances);
}

function handleTokenBalancesError(msg) {
  const payload = unwrapWs(msg);
  isLoadingTokens.value = false;
  applyBalances([{
    network: 'unknown',
    tokenAddress: 'error',
    tokenName: t('tokenBalances.fetchError'),
    symbol: 'ERROR',
    balance: '0',
    minBalance: '0',
    readonlyThreshold: 1,
    editorThreshold: 1,
    error: payload.error || t('common.unknownError'),
    errorDetails: payload.errorDetails || payload.error,
  }]);
}

function handleTokenBalancesUpdated(msg) {
  applyBalances(unwrapWs(msg).balances);
}

function handleTokenBalanceChanged(msg) {
  const auth = useAuth();
  const payload = unwrapWs(msg);
  const tokenIndex = tokenBalances.value.findIndex(
    (token) => token.tokenAddress === payload.tokenAddress && token.network === payload.network
  );
  if (tokenIndex !== -1) {
    tokenBalances.value[tokenIndex].balance = payload.balance;
    auth.tokenBalances.value = [...tokenBalances.value];
    lastUpdateTime.value = new Date();
  }
}

function handleAuthTokenCatalogChanged() {
  const auth = useAuth();
  const wallet = auth.address?.value
    || auth.identities?.value?.find((id) => id.provider === 'wallet')?.provider_id;
  if (wallet) {
    requestTokenBalances(wallet, auth.userId?.value);
    if (typeof auth.checkTokenBalances === 'function') {
      auth.checkTokenBalances(wallet);
    }
  }
}

function bindListeners() {
  if (listenersBound > 0) {
    listenersBound += 1;
    return;
  }
  wsClient.on('token_balances_response', handleTokenBalancesResponse);
  wsClient.on('token_balances_error', handleTokenBalancesError);
  wsClient.on('token_balances_updated', handleTokenBalancesUpdated);
  wsClient.on('token_balance_changed', handleTokenBalanceChanged);
  wsClient.on('auth_token_added', handleAuthTokenCatalogChanged);
  wsClient.on('auth_token_deleted', handleAuthTokenCatalogChanged);
  wsClient.on('auth_token_updated', handleAuthTokenCatalogChanged);
  listenersBound = 1;
}

function unbindListeners() {
  if (listenersBound <= 0) return;
  listenersBound -= 1;
  if (listenersBound > 0) return;
  wsClient.off('token_balances_response', handleTokenBalancesResponse);
  wsClient.off('token_balances_error', handleTokenBalancesError);
  wsClient.off('token_balances_updated', handleTokenBalancesUpdated);
  wsClient.off('token_balance_changed', handleTokenBalanceChanged);
  wsClient.off('auth_token_added', handleAuthTokenCatalogChanged);
  wsClient.off('auth_token_deleted', handleAuthTokenCatalogChanged);
  wsClient.off('auth_token_updated', handleAuthTokenCatalogChanged);
}

function stopAutoUpdate() {
  if (autoUpdateInterval) {
    clearInterval(autoUpdateInterval);
    autoUpdateInterval = null;
  }
}

function startAutoUpdate(address, userId) {
  stopAutoUpdate();
  if (address) {
    requestTokenBalances(address, userId);
  }
  autoUpdateInterval = setInterval(() => {
    if (address) {
      requestTokenBalances(address, userId);
    }
  }, 5 * 60 * 1000);
}

export function useTokenBalancesWebSocket() {
  const formattedLastUpdate = computed(() => {
    if (!lastUpdateTime.value) return t('tokenBalances.neverUpdated');
    return lastUpdateTime.value.toLocaleTimeString();
  });

  onMounted(bindListeners);
  onUnmounted(() => {
    unbindListeners();
    if (listenersBound === 0) {
      stopAutoUpdate();
    }
  });

  return {
    tokenBalances: computed(() => tokenBalances.value),
    isLoadingTokens: computed(() => isLoadingTokens.value),
    lastUpdateTime: computed(() => lastUpdateTime.value),
    formattedLastUpdate,
    requestTokenBalances,
    startAutoUpdate,
    stopAutoUpdate,
  };
}
