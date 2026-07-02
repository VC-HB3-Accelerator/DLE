/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { setRegionUrlsCache } from '../config/regionUrlsCache';

export async function fetchRegionUrls() {
  const response = await api.get('/settings/region-urls');
  if (response.data?.success) {
    const data = response.data.data || { regions: [] };
    setRegionUrlsCache(data);
    return data;
  }
  return { regions: [] };
}

export async function saveRegionUrls(payload) {
  const response = await api.put('/settings/region-urls', payload);
  if (response.data?.success) {
    setRegionUrlsCache(response.data.data);
    return response.data.data;
  }
  throw new Error(response.data?.error || 'Save failed');
}
