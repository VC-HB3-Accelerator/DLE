/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { getPrivacyDocsUrl } from '../constants/publishedDocs';

const blogEngagementService = {
  async getEngagement(pageId) {
    const res = await api.get(`/blog/pages/${pageId}/engagement`);
    return res.data;
  },

  async toggleReaction(pageId, type) {
    const res = await api.post(`/blog/pages/${pageId}/reaction`, { type });
    return res.data;
  },

  /** @deprecated используйте toggleReaction(..., 'heart') */
  async toggleLike(pageId) {
    return this.toggleReaction(pageId, 'heart');
  },

  async recordView(pageId) {
    const key = `blog_viewed_${pageId}`;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) {
        return null;
      }
    } catch {
      /* ignore */
    }
    const res = await api.post(`/blog/pages/${pageId}/view`);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, '1');
      }
    } catch {
      /* ignore */
    }
    return res.data;
  },

  async addComment(pageId, body, parentId = null) {
    const res = await api.post(`/blog/pages/${pageId}/comments`, {
      body,
      parent_id: parentId,
    });
    return res.data;
  },

  async hideComment(commentId) {
    const res = await api.delete(`/blog/comments/${commentId}`);
    return res.data;
  },

  async subscribe(email, sourcePageId = null, options = {}) {
    const res = await api.post('/blog/subscribe', {
      email,
      source_page_id: sourcePageId,
      privacy_consent: Boolean(options.privacyConsent),
      privacy_consent_url: options.privacyConsentUrl || getPrivacyDocsUrl(),
    });
    return res.data;
  },
};

export default blogEngagementService;
