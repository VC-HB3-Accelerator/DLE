/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Сохраняет намерение «Написать/Позвонить» до входа, чтобы после auth
 * не потерять объявление при сбросе query-фильтров.
 */

const STORAGE_KEY = 'listing_contact_intent';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * @typedef {{ page_id: number, slug?: string, action: 'write'|'call', saved_at: number }} ListingIntent
 */

/**
 * @param {{ page_id: number|string, slug?: string, action?: 'write'|'call' }} payload
 */
export function saveListingIntent(payload) {
  const pageId = Number(payload?.page_id);
  if (!Number.isInteger(pageId) || pageId <= 0) return;
  const action = payload.action === 'call' ? 'call' : 'write';
  /** @type {ListingIntent} */
  const data = {
    page_id: pageId,
    slug: payload.slug ? String(payload.slug).trim() : '',
    action,
    saved_at: Date.now(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/** @returns {ListingIntent|null} */
export function loadListingIntent() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const pageId = Number(data?.page_id);
    if (!Number.isInteger(pageId) || pageId <= 0) {
      clearListingIntent();
      return null;
    }
    const savedAt = Number(data.saved_at) || 0;
    if (savedAt && Date.now() - savedAt > MAX_AGE_MS) {
      clearListingIntent();
      return null;
    }
    return {
      page_id: pageId,
      slug: data.slug ? String(data.slug).trim() : '',
      action: data.action === 'call' ? 'call' : 'write',
      saved_at: savedAt,
    };
  } catch {
    return null;
  }
}

export function clearListingIntent() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
