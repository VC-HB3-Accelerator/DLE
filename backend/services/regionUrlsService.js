/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const encryptedDb = require('./encryptedDatabaseService');
const { getSecret } = require('./secretStore');

const TABLE = 'region_servers';
const VDS_TABLE = 'vds_settings';
const REGION_URLS_KEY = 'REGION_SERVER_URLS';
const PRIMARY_ID = 'local';

function normalizeUrl(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function isValidUrl(value) {
  if (!value) {
    return true;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugifyId(label, fallbackIndex) {
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0400-\u04FF-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `region-${fallbackIndex}`;
}

function normalizeRegionItem(item, index, seenIds) {
  const label = String(item?.label || '').trim();
  const url = normalizeUrl(item?.url);
  if (!label && !url) {
    return null;
  }

  let id = String(item?.id || item?.slug || '').trim();
  if (!id) {
    id = slugifyId(label, index);
  }
  while (seenIds.has(id)) {
    id = `${id}-${index}`;
  }
  seenIds.add(id);

  return { id, label, url };
}

function migrateLegacyFormat(parsed) {
  const regions = [];
  if (parsed.ru) {
    regions.push({ id: 'ru', label: 'Россия', url: normalizeUrl(parsed.ru) });
  }
  if (parsed.en) {
    regions.push({ id: 'en', label: 'International', url: normalizeUrl(parsed.en) });
  }
  return regions;
}

function parseStored(rawValue) {
  if (!rawValue) {
    return { regions: [] };
  }

  let parsed = rawValue;
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return { regions: [] };
    }
  }

  if (Array.isArray(parsed.regions)) {
    const seenIds = new Set();
    const regions = parsed.regions
      .map((item, index) => normalizeRegionItem(item, index, seenIds))
      .filter(Boolean)
      .filter((item) => item.label && item.url);

    return {
      regions,
      updatedAt: parsed.updatedAt || null,
    };
  }

  return {
    regions: migrateLegacyFormat(parsed),
    updatedAt: parsed.updatedAt || null,
  };
}

function isLocalHost(host) {
  if (!host) {
    return false;
  }
  const hostname = String(host).split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function resolvePrimaryUrl(domain, req) {
  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host && isLocalHost(host)) {
      const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
      return normalizeUrl(`${proto}://${host}`);
    }
  }

  const normalizedDomain = String(domain || '').trim();
  if (normalizedDomain) {
    return normalizeUrl(normalizedDomain);
  }

  if (req) {
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) {
      const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
      return normalizeUrl(`${proto}://${host}`);
    }
  }

  if (process.env.BASE_URL) {
    return normalizeUrl(process.env.BASE_URL);
  }

  return '';
}

function resolveDefaultPrimaryLabel(regionLabel, primaryUrl) {
  const custom = String(regionLabel || '').trim();
  if (custom) {
    return custom;
  }

  try {
    const parsed = new URL(primaryUrl);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return parsed.port ? `localhost:${parsed.port}` : 'localhost';
    }
    return parsed.hostname;
  } catch {
    return 'local';
  }
}

async function getVdsPrimaryConfig() {
  const rows = await encryptedDb.getData(VDS_TABLE, {}, 1);
  if (!rows?.length) {
    return { domain: '', regionLabel: '' };
  }

  return {
    domain: String(rows[0].domain || '').trim(),
    regionLabel: String(rows[0].region_label || '').trim(),
  };
}

async function savePrimaryRegionLabel(label) {
  const trimmed = String(label || '').trim();
  if (!trimmed) {
    throw new Error('Region 1: label required');
  }

  const existing = await encryptedDb.getData(VDS_TABLE, {}, 1);
  if (existing?.length) {
    await encryptedDb.saveData(
      VDS_TABLE,
      { region_label: trimmed, updated_at: new Date() },
      { id: existing[0].id }
    );
    return;
  }

  await encryptedDb.saveData(VDS_TABLE, {
    region_label: trimmed,
    updated_at: new Date(),
  });
}

function rowsToPayload(rows) {
  const regions = rows.map((row) => ({
    id: row.slug,
    label: row.label,
    url: row.url,
  }));

  let updatedAt = null;
  for (const row of rows) {
    if (!row.updated_at) {
      continue;
    }
    const iso = new Date(row.updated_at).toISOString();
    if (!updatedAt || iso > updatedAt) {
      updatedAt = iso;
    }
  }

  return { regions, updatedAt };
}

async function loadAdditionalRegions() {
  const rows = await encryptedDb.getData(TABLE, {}, null, 'sort_order ASC, id ASC');
  return rows.filter((row) => row.slug !== PRIMARY_ID && row.slug !== 'primary');
}

async function saveAdditionalRegionsToTable(regions) {
  await encryptedDb.deleteData(TABLE, {});

  for (let index = 0; index < regions.length; index += 1) {
    const region = regions[index];
    await encryptedDb.saveData(TABLE, {
      slug: region.id,
      label: region.label,
      url: region.url,
      sort_order: index,
      updated_at: new Date(),
    });
  }
}

async function migrateFromSecretsIfNeeded() {
  const existing = await encryptedDb.getData(TABLE, {}, 1);
  if (existing && existing.length > 0) {
    return;
  }

  const stored = await getSecret(REGION_URLS_KEY);
  const parsed = parseStored(stored);
  if (!parsed.regions.length) {
    return;
  }

  await saveAdditionalRegionsToTable(parsed.regions);

  try {
    await encryptedDb.deleteData('secrets', { key: REGION_URLS_KEY });
  } catch {
    // legacy-запись необязательна к удалению
  }
}

function buildPrimaryRegion({ domain, regionLabel }, req) {
  const url = resolvePrimaryUrl(domain, req);
  if (!url) {
    return null;
  }

  return {
    id: PRIMARY_ID,
    label: resolveDefaultPrimaryLabel(regionLabel, url),
    url,
    isPrimary: true,
  };
}

async function getRegionUrls(req = null) {
  await migrateFromSecretsIfNeeded();

  const vdsConfig = await getVdsPrimaryConfig();
  const primary = buildPrimaryRegion(vdsConfig, req);
  const additionalRows = await loadAdditionalRegions();
  const { regions: additional, updatedAt } = rowsToPayload(additionalRows);

  const primaryUrl = primary?.url || '';
  const filteredAdditional = primaryUrl
    ? additional.filter((region) => normalizeUrl(region.url) !== primaryUrl)
    : additional;

  const regions = primary ? [primary, ...filteredAdditional] : filteredAdditional;

  return {
    regions,
    updatedAt: updatedAt || (primary ? new Date().toISOString() : null),
  };
}

function splitPrimaryAndAdditional(regions) {
  if (!regions.length) {
    return { primary: null, additional: [] };
  }

  const [first, ...rest] = regions;
  const firstId = String(first?.id || first?.slug || '').trim();

  if (first?.isPrimary || firstId === PRIMARY_ID || firstId === 'primary') {
    return { primary: first, additional: rest };
  }

  return { primary: first, additional: rest };
}

async function setRegionUrls({ regions }, req = null) {
  if (!Array.isArray(regions)) {
    throw new Error('Invalid regions payload');
  }

  const { primary, additional } = splitPrimaryAndAdditional(regions);

  if (primary) {
    await savePrimaryRegionLabel(primary.label);
  }

  const normalized = [];
  const seenIds = new Set([PRIMARY_ID, 'primary']);

  additional.forEach((item, index) => {
    const label = String(item?.label || '').trim();
    const url = normalizeUrl(item?.url);

    if (!label && !url) {
      return;
    }

    if (!label) {
      throw new Error(`Region ${index + 2}: label required`);
    }
    if (!url) {
      throw new Error(`Region ${index + 2}: URL required`);
    }
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL for "${label}"`);
    }

    let id = String(item?.id || item?.slug || '').trim();
    if (!id || id === PRIMARY_ID || id === 'primary') {
      id = slugifyId(label, index);
    }
    while (seenIds.has(id)) {
      id = `${id}-${index}`;
    }
    seenIds.add(id);

    normalized.push({ id, label, url });
  });

  await saveAdditionalRegionsToTable(normalized);

  const payload = await getRegionUrls(req);
  return {
    ...payload,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getRegionUrls,
  setRegionUrls,
  normalizeUrl,
  isValidUrl,
  PRIMARY_ID,
};
