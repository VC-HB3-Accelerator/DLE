/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Список / удаление медиатеки CMS (+ очистка вложений чата).
 * Upload — useChunkedMediaUpload, не дублировать.
 */

import api from '../api/axios';

export default {
  /**
   * @param {{ media_type?: string, q?: string, limit?: number, offset?: number, scope?: 'cms'|'all', source?: string }} opts
   * scope=cms — только статьи (пикер); scope=all — CMS+чат+гости (очистка)
   */
  async list({ media_type, q, limit = 24, offset = 0, scope = 'cms', source } = {}) {
    const params = { limit, offset, scope };
    if (media_type) params.media_type = media_type;
    if (q) params.q = q;
    if (source) params.source = source;
    const res = await api.get('/uploads/media', { params });
    return res.data;
  },
  async remove(id, source = 'cms') {
    const res = await api.delete(`/uploads/media/${id}`, {
      params: { source: source || 'cms' },
    });
    return res.data;
  },
};
