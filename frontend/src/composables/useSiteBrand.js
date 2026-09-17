/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Бренд шапки: картинка + описание из /settings/sidebar/text (sidebar_notice).
 */

import { ref, computed, provide, inject, watch } from 'vue';
import { fetchSidebarNotice } from '@/services/sidebarNoticeService';
import { applyFavicon, DEFAULT_OG_IMAGE } from '@/utils/siteMetaDescription';

const DEFAULT_BRAND_IMAGE = DEFAULT_OG_IMAGE;
const SITE_BRAND_KEY = Symbol('siteBrand');

const headerDescription = ref('');
const brandImageUrl = ref('');
const hideBrandImage = ref(false);
const isLoading = ref(false);
let loadPromise = null;

function resolvePublicUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('http') || raw.startsWith('data:') || raw.startsWith('/')) return raw;
  if (typeof window === 'undefined') return `/${raw.replace(/^\/+/, '')}`;
  return `${window.location.origin}/${raw.replace(/^\/+/, '')}`;
}

const headerLogoUrl = computed(() => {
  if (hideBrandImage.value) return '';
  return resolvePublicUrl(brandImageUrl.value || DEFAULT_BRAND_IMAGE);
});

function syncFaviconFromBrand() {
  if (hideBrandImage.value) {
    applyFavicon('/favicon.ico');
    return;
  }
  applyFavicon(resolvePublicUrl(brandImageUrl.value || DEFAULT_BRAND_IMAGE));
}

function applyBrand(data) {
  headerDescription.value = String(data?.headerDescription || '').trim();
  brandImageUrl.value = String(data?.ogImageUrl || '').trim();
  hideBrandImage.value = Boolean(data?.hideOgImage);
  syncFaviconFromBrand();
}

async function loadSiteBrand({ force = false } = {}) {
  if (loadPromise && !force) return loadPromise;
  isLoading.value = true;
  loadPromise = (async () => {
    try {
      const data = await fetchSidebarNotice();
      applyBrand(data);
      return data;
    } catch (error) {
      console.error('[useSiteBrand] load failed:', error);
      return null;
    } finally {
      isLoading.value = false;
    }
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

function setSiteBrandLocal(partial = {}) {
  if (partial.headerDescription !== undefined) {
    headerDescription.value = String(partial.headerDescription || '').trim();
  }
  if (partial.ogImageUrl !== undefined) {
    brandImageUrl.value = String(partial.ogImageUrl || '').trim();
  }
  if (partial.hideOgImage !== undefined) {
    hideBrandImage.value = Boolean(partial.hideOgImage);
  }
  syncFaviconFromBrand();
}

watch([brandImageUrl, hideBrandImage], () => {
  syncFaviconFromBrand();
});

const siteBrandApi = {
  headerDescription,
  brandImageUrl,
  hideBrandImage,
  headerLogoUrl,
  isLoading,
  loadSiteBrand,
  setSiteBrandLocal,
  DEFAULT_BRAND_IMAGE,
};

export function provideSiteBrand() {
  provide(SITE_BRAND_KEY, siteBrandApi);
  return siteBrandApi;
}

export function useSiteBrand() {
  return inject(SITE_BRAND_KEY, siteBrandApi);
}

// первичная загрузка
loadSiteBrand();
