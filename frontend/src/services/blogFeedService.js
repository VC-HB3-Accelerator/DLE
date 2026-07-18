/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';

const blogFeedService = {
  async getFeedFilters() {
    const res = await api.get('/blog/feed-filters');
    return res.data?.filters || [];
  },

  async getFeedSettings() {
    const res = await api.get('/blog/feed-settings');
    return res.data;
  },

  async saveFeedSettings(payload) {
    const res = await api.put('/blog/feed-settings', payload);
    return res.data;
  },
};

export default blogFeedService;
