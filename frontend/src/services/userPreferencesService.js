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

import api from '../api/axios';

export const CONTACTS_FILTERS_PREFERENCE_KEY = 'contacts_filters';

export async function getPreference(key) {
  const { data } = await api.get(`/users/me/preferences/${encodeURIComponent(key)}`);
  if (data?.success) {
    return data.preference?.value ?? null;
  }
  return null;
}

export async function setPreference(key, value, metadata) {
  const body = { value };
  if (metadata !== undefined) {
    body.metadata = metadata;
  }
  const { data } = await api.put(`/users/me/preferences/${encodeURIComponent(key)}`, body);
  if (data?.success) {
    return data.preference?.value ?? null;
  }
  return null;
}

export default {
  CONTACTS_FILTERS_PREFERENCE_KEY,
  getPreference,
  setPreference
};
