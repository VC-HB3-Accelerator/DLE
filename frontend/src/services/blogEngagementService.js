/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { getPrivacyDocsUrl } from '../constants/publishedDocs';

const recordViewInFlight = new Set();

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

  viewStorageKey(pageId) {
    return `blog_viewed_${pageId}`;
  },

  hasRecordedView(pageId) {
    try {
      return Boolean(localStorage.getItem(this.viewStorageKey(pageId)));
    } catch {
      return false;
    }
  },

  markRecordedView(pageId) {
    try {
      localStorage.setItem(this.viewStorageKey(pageId), '1');
    } catch {
      /* ignore */
    }
  },

  async recordView(pageId) {
    if (!pageId || this.hasRecordedView(pageId) || recordViewInFlight.has(pageId)) {
      return null;
    }
    recordViewInFlight.add(pageId);
    this.markRecordedView(pageId);
    try {
      const res = await api.post(`/blog/pages/${pageId}/view`);
      return res.data;
    } catch (error) {
      recordViewInFlight.delete(pageId);
      try {
        localStorage.removeItem(this.viewStorageKey(pageId));
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      recordViewInFlight.delete(pageId);
    }
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

  async requestSubscribeCode(email, options = {}) {
    const res = await api.post('/blog/subscriptions/request-code', {
      email,
      privacy_consent: Boolean(options.privacyConsent),
      privacy_consent_url: options.privacyConsentUrl || getPrivacyDocsUrl(),
    });
    return res.data;
  },

  async verifySubscribe(payload = {}) {
    const res = await api.post('/blog/subscriptions/verify', {
      email: payload.email,
      code: payload.code,
      filters: payload.filters || {},
      privacy_consent: Boolean(payload.privacyConsent),
      privacy_consent_url: payload.privacyConsentUrl || getPrivacyDocsUrl(),
      source_page_id: payload.sourcePageId || null,
    });
    return res.data;
  },

  async createSubscription(filters = {}, options = {}) {
    const res = await api.post('/blog/subscriptions', {
      filters,
      privacy_consent_url: options.privacyConsentUrl || getPrivacyDocsUrl(),
      source_page_id: options.sourcePageId || null,
      email: options.email || undefined,
    });
    return res.data;
  },

  async listMySubscriptions() {
    const res = await api.get('/blog/subscriptions/mine');
    return res.data;
  },

  async deleteSubscription(id) {
    const res = await api.delete(`/blog/subscriptions/${encodeURIComponent(id)}`);
    return res.data;
  },

  async deleteAllSubscriptions() {
    const res = await api.delete('/blog/subscriptions');
    return res.data;
  },
};

export default blogEngagementService;
