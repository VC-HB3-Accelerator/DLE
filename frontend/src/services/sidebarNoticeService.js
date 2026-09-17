/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { getPrivacyDocsUrl } from '../constants/publishedDocs';

export async function fetchSidebarNotice() {
  const response = await api.get('/settings/sidebar-notice');
  if (response.data?.success) {
    return response.data.data || {
      body: '',
      domainDescription: '',
      headerDescription: '',
      ogImageUrl: '',
      hideOgImage: false,
      privacyPath: getPrivacyDocsUrl(),
    };
  }
  return {
    body: '',
    domainDescription: '',
    headerDescription: '',
    ogImageUrl: '',
    hideOgImage: false,
    privacyPath: getPrivacyDocsUrl(),
  };
}

export async function saveSidebarNotice({
  body,
  domainDescription,
  headerDescription,
  ogImageUrl,
  hideOgImage,
}) {
  const response = await api.put('/settings/sidebar-notice', {
    body,
    domainDescription,
    headerDescription,
    ogImageUrl,
    hideOgImage,
  });
  if (response.data?.success) {
    return response.data.data;
  }
  throw new Error(response.data?.error || 'Save failed');
}

/** Загрузка картинки для og:image главной. Возвращает относительный URL. */
export async function uploadSiteOgImage(file) {
  const form = new FormData();
  form.append('logo', file);
  const response = await api.post('/uploads/logo', form);
  if (!response.data?.success) {
    throw new Error(response.data?.message || response.data?.error || 'Upload failed');
  }
  const raw = response.data?.data?.url || response.data?.data?.path || '';
  if (!raw) throw new Error('Upload failed');
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return `${u.pathname}${u.search || ''}`;
    }
  } catch (_) { /* keep */ }
  const path = String(raw).replace(/^\/+/, '');
  return path.startsWith('uploads/') ? `/${path}` : raw.startsWith('/') ? raw : `/${path}`;
}
