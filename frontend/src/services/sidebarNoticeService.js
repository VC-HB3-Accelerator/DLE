/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { getPrivacyDocsUrl } from '../constants/publishedDocs';

export async function fetchSidebarNotice() {
  const response = await api.get('/settings/sidebar-notice');
  if (response.data?.success) {
    return response.data.data || { body: '', privacyPath: getPrivacyDocsUrl() };
  }
  return { body: '', privacyPath: getPrivacyDocsUrl() };
}

export async function saveSidebarNotice(body) {
  const response = await api.put('/settings/sidebar-notice', { body });
  if (response.data?.success) {
    return response.data.data;
  }
  throw new Error(response.data?.error || 'Save failed');
}
