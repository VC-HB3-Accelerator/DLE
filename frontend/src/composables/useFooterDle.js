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
import { getFromStorage, setToStorage } from '../utils/storage';

// === SINGLETON STATE ===
const footerDle = ref(null);
const isLoading = ref(false);
const selectedDleAddress = ref(null);

// Загрузка адреса выбранного DLE из localStorage при инициализации
function loadSavedDleAddress() {
  try {
    const savedAddress = getFromStorage('footerDleAddress', null);
    if (savedAddress) {
      selectedDleAddress.value = savedAddress;
      // Загружаем актуальные данные из блокчейна
      loadDleFromBlockchain(savedAddress).then((loadedDle) => {
        if (loadedDle) {
          footerDle.value = loadedDle;
        }
      });
    }
  } catch (error) {
    console.warn('[useFooterDle] Ошибка при загрузке адреса из localStorage:', error);
  }
}

// Инициализация при загрузке модуля
loadSavedDleAddress();

// === API ===

/**
 * Загружает данные DLE из блокчейна по адресу
 */
async function loadDleFromBlockchain(dleAddress) {
  try {
    isLoading.value = true;
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      const blockchainData = response.data.data;
      return {
        address: dleAddress,
        name: blockchainData.name || '',
        symbol: blockchainData.symbol || '',
        logoURI: blockchainData.logoURI || ''
      };
    }
    return null;
  } catch (error) {
    console.error('[useFooterDle] Ошибка при загрузке DLE из блокчейна:', error);
    return null;
  } finally {
    isLoading.value = false;
  }
}

/**
 * Устанавливает выбранный DLE для отображения в футере
 * Сохраняет только адрес, данные всегда загружаются из блокчейна
 * @param {string} dleAddress - Адрес DLE
 */
async function setFooterDle(dleAddress) {
  if (!dleAddress) {
    footerDle.value = null;
    selectedDleAddress.value = null;
    // Удаляем из localStorage
    try {
      setToStorage('footerDleAddress', null);
    } catch (error) {
      console.warn('[useFooterDle] Ошибка при удалении из localStorage:', error);
    }
    return;
  }

  // Сохраняем только адрес
  selectedDleAddress.value = dleAddress;
  setToStorage('footerDleAddress', dleAddress);

  // Всегда загружаем актуальные данные из блокчейна
  const loadedDle = await loadDleFromBlockchain(dleAddress);
  if (loadedDle) {
    footerDle.value = loadedDle;
  } else {
    // Если не удалось загрузить, очищаем состояние
    footerDle.value = null;
  }
}

/**
 * Обновляет данные выбранного DLE из блокчейна
 * Используется для периодического обновления или при необходимости
 */
async function refreshFooterDle() {
  if (!selectedDleAddress.value) {
    return;
  }

  const loadedDle = await loadDleFromBlockchain(selectedDleAddress.value);
  if (loadedDle) {
    footerDle.value = loadedDle;
  }
}

/**
 * Очищает выбранный DLE
 */
function clearFooterDle() {
  footerDle.value = null;
  selectedDleAddress.value = null;
  // Удаляем адрес из localStorage
  try {
    setToStorage('footerDleAddress', null);
  } catch (error) {
    console.warn('[useFooterDle] Ошибка при очистке localStorage:', error);
  }
}

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

