/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

export function buildPageTitle(headerTitle, headerDescription, domainDescriptionFallback = '') {
  const name = String(headerTitle || '').replace(/\s+/g, ' ').trim();
  const sub = String(headerDescription || '').replace(/\s+/g, ' ').trim();
  if (name && sub) return `${name} — ${sub}`.slice(0, 120);
  if (name) return name.slice(0, 120);
  if (sub) return sub.slice(0, 120);
  return String(domainDescriptionFallback || '').trim().slice(0, 120);
}

export function siteNameFromHeaderTitle(headerTitle, domainDescriptionFallback = '') {
  const name = String(headerTitle || '').replace(/\s+/g, ' ').trim();
  if (name) return name.slice(0, 80);
  const value = String(domainDescriptionFallback || '').trim();
  const part = value.split(/\s+[—–-]\s+/)[0].trim();
  return (part || value).slice(0, 80);
}

export function formatDleDisplayTitle(name, symbol) {
  const n = String(name || '').trim();
  if (!n) return '';
  const s = String(symbol || '').trim();
  return s ? `${n} (${s})` : n;
}
