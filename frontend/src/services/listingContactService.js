/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '../api/axios';
import { getPrivacyDocsUrl } from '../constants/publishedDocs';

let statusCache = null;
let statusPromise = null;
const STATUS_TTL_MS = 60_000;

const listingContactService = {
  async getStatus({ force = false } = {}) {
    const now = Date.now();
    if (!force && statusCache && now - statusCache.at < STATUS_TTL_MS) {
      return statusCache.data;
    }
    if (!force && statusPromise) return statusPromise;
    statusPromise = api
      .get('/blog/listing-contact/status')
      .then((res) => {
        statusCache = { data: res.data, at: Date.now() };
        return res.data;
      })
      .finally(() => {
        statusPromise = null;
      });
    return statusPromise;
  },

  /**
   * @param {{ pageId: number, action?: 'write'|'call', contact: string, privacyConsent?: boolean, guestSession?: string, finalize?: boolean }} opts
   */
  async upsertGuestLead(opts) {
    const res = await api.post('/blog/listing-contact/guest-lead', {
      page_id: opts.pageId,
      action: opts.action === 'call' ? 'call' : 'write',
      contact: opts.contact,
      privacy_consent: Boolean(opts.privacyConsent),
      privacy_consent_url: getPrivacyDocsUrl(),
      guest_session: opts.guestSession || null,
      finalize: Boolean(opts.finalize),
    });
    return res.data;
  },

  /**
   * @param {{ pageId: number, action?: 'write'|'call' }} opts
   */
  async writeAsUser(opts) {
    const res = await api.post('/blog/listing-contact/write', {
      page_id: opts.pageId,
      action: opts.action === 'call' ? 'call' : 'write',
    });
    return res.data;
  },
};

export default listingContactService;
