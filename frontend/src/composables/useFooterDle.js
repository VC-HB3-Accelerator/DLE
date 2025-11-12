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

import { ref, provide, inject } from 'vue';
import api from '../api/axios';

// === SINGLETON STATE ===
const footerDle = ref(null);
const isLoading = ref(false);
const selectedDleAddress = ref(null);

/**
 * Загружает данные DLE из блокчейна по адресу
 */
async function loadDleFromBlockchain(dleAddress, chainId = null) {
  try {
    const payload = { dleAddress };
    if (chainId !== undefined && chainId !== null) {
      payload.chainId = chainId;
    }

    const response = await api.post('/blockchain/read-dle-info', payload);
    
    if (response.data.success) {
      const blockchainData = response.data.data;
      return {
        address: dleAddress,
        name: blockchainData.name || '',
        symbol: blockchainData.symbol || '',
        logoURI: blockchainData.logoURI || '',
        chainId: blockchainData.currentChainId ?? chainId ?? null
      };
    }
    return null;
  } catch (error) {
    console.error('[useFooterDle] Ошибка при загрузке DLE из блокчейна:', error);
    return null;
  }
}

/**
 * Загружает текущее значение футера из backend
 */
async function fetchFooterSelection() {
  try {
    isLoading.value = true;
    const response = await api.get('/settings/footer-dle');
    const selection = response.data?.data || null;

    if (selection && selection.address) {
      selectedDleAddress.value = selection.address;
      const loadedDle = await loadDleFromBlockchain(selection.address, selection.chainId ?? null);

      if (loadedDle) {
        footerDle.value = loadedDle;
      } else {
        footerDle.value = {
          address: selection.address,
          name: '',
          symbol: '',
          logoURI: '',
          chainId: selection.chainId ?? null
        };
      }
    } else {
      selectedDleAddress.value = null;
      footerDle.value = null;
    }
  } catch (error) {
    console.error('[useFooterDle] Ошибка при получении footer DLE с backend:', error);
  } finally {
    isLoading.value = false;
  }
}

/**
 * Устанавливает выбранный DLE для отображения в футере через backend
 * @param {string} dleAddress - Адрес DLE
 */
async function setFooterDle(dleAddress, chainId = null) {
  if (!dleAddress) {
    return clearFooterDle();
  }

  try {
    isLoading.value = true;
    await api.post('/settings/footer-dle', {
      dleAddress,
      chainId: chainId ?? null
    });
    await fetchFooterSelection();
  } catch (error) {
    console.error('[useFooterDle] Ошибка при сохранении footer DLE:', error);
    throw error;
  } finally {
    isLoading.value = false;
  }
}

/**
 * Обновляет данные выбранного DLE, синхронизируя их с backend и блокчейном
 */
async function refreshFooterDle() {
  await fetchFooterSelection();
}

/**
 * Очищает выбранный DLE
 */
async function clearFooterDle() {
  try {
    isLoading.value = true;
    await api.delete('/settings/footer-dle');
    await fetchFooterSelection();
  } catch (error) {
    console.error('[useFooterDle] Ошибка при очистке footer DLE:', error);
    throw error;
  } finally {
    isLoading.value = false;
  }
}

// Первичная загрузка при инициализации
fetchFooterSelection();

// === SINGLETON API ===
const footerDleApi = {
  footerDle,
  isLoading,
  selectedDleAddress,
  setFooterDle,
  clearFooterDle,
  refreshFooterDle,
  loadDleFromBlockchain
};

// === PROVIDE/INJECT HELPERS ===
const FOOTER_DLE_KEY = Symbol('footerDle');

export function provideFooterDle() {
  provide(FOOTER_DLE_KEY, footerDleApi);
}

export function useFooterDle() {
  const ctx = inject(FOOTER_DLE_KEY);
  if (!ctx) {
    // Если контекст не предоставлен, возвращаем singleton напрямую
    return footerDleApi;
  }
  return ctx;
}

