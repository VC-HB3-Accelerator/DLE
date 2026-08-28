/**
 * Split multi-value import cells and normalize website URLs.
 * Import email policy: corporate domains only; drop free-mail and role/mailbox junk.
 */

const JUNK_VALUE_RE = /^(нет|нету|нет\.|no|n\/?a|none|null|nil|-|—|–|\.|…|без|отсутствует|не указан[ао]?|неизвестно|unknown|empty|undefined)$/i;

/** Публичные / free-mail домены — не считаем корпоративными сотрудниками */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'yandex.ru', 'yandex.com', 'ya.ru',
  'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'internet.ru',
  'icloud.com', 'me.com', 'mac.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'proton.me', 'protonmail.com',
  'rambler.ru', 'auto.ru',
  'aol.com', 'gmx.com', 'gmx.de', 'mail.com',
  'zoho.com', 'tutanota.com', 'fastmail.com',
  'qq.com', '163.com', '126.com'
]);

/**
 * Локальная часть: заявки / саппорт / авторассылка / служебный мусор.
 * info / contact / office / admin — оставляем (секретарь, приёмная — важное касание).
 */
const ROLE_EMAIL_LOCAL_RE = /^(noreply|no-?reply|do-?not-?reply|donotreply|mailer-?daemon|postmaster|webmaster|abuse|privacy|support|helpdesk|help|servicedesk|customer-?service|sales|marketing|advertise|ads|pr|press|media|newsletter|subscribe|unsubscribe|mailer|mailing|bounce|notification|notifications|alerts?|robot|bots?|auto|autoresponder|zakaz|order|orders|booking|request|requests|zayavk[ai]|feedback|faq|hr|jobs?|career|careers|vacancy|resume|spam|security|billing|invoice|receipts?|digest|broadcast|bulk|root)$/i;

function isJunkImportValue(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return true;
  return JUNK_VALUE_RE.test(text);
}

function splitMultiValues(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text || isJunkImportValue(text)) return [];

  // ; | newline always;
  // comma before: email / phone / http(s)|www / bare domain (site.ru, a.b.ru/path)
  const parts = text
    .split(/[;\n|]+/)
    .flatMap((part) => String(part).split(
      /,(?=\s*(?:[^\s,;|]+@[^\s,;|]+|[+\d(]|https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,;|]*)?))/i
    ))
    .map((s) => s.trim())
    .filter((s) => s && !isJunkImportValue(s));

  return [...new Set(parts)];
}

function normalizeWebsiteUrl(raw) {
  let value = String(raw || '').trim();
  if (!value || isJunkImportValue(value)) return null;
  // Reject bare emails mistaken for sites
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  // Unsplitted multi-value cell (comma list) — not a single URL
  if (/[,\s].*\./.test(value) && value.includes(',')) return null;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || u.hostname === 'localhost') return null;
    if (u.hostname.includes(',')) return null;
    // Reject punycode junk from words like «нет»
    if (/^xn--/i.test(u.hostname) && u.hostname.length < 16) return null;
    u.hash = '';
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return null;
  }
}

function collectMappedMulti(contact, fieldNames) {
  const out = [];
  for (const name of fieldNames) {
    const val = contact?.[name];
    if (val == null || val === '') continue;
    if (Array.isArray(val)) {
      for (const item of val) out.push(...splitMultiValues(item));
    } else {
      out.push(...splitMultiValues(val));
    }
  }
  return [...new Set(out.map((s) => String(s).trim()).filter(Boolean))];
}

/**
 * Корп. email для импорта: не free-mail, не role/mailbox.
 * @returns {{ ok: true, email: string } | { ok: false, reason: string }}
 */
function classifyImportEmail(rawEmail) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'некорректный формат' };
  }
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return { ok: false, reason: 'некорректный формат' };
  }
  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, reason: `публичный домен ${domain}` };
  }
  // local может быть name+tag — берём базу до +
  const localBase = local.split('+')[0];
  if (ROLE_EMAIL_LOCAL_RE.test(localBase)) {
    return { ok: false, reason: `служебный ящик ${localBase}@` };
  }
  return { ok: true, email };
}

function websiteHostname(url) {
  try {
    const normalized = normalizeWebsiteUrl(url) || String(url || '');
    const host = new URL(normalized).hostname.toLowerCase().replace(/\.$/, '');
    if (!host || host === 'localhost') return null;
    return host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function emailDomainOf(email) {
  const e = String(email || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return null;
  const domain = e.slice(at + 1).trim();
  return domain || null;
}

/** hostname сайта ↔ домен email (включая поддомены) */
function websiteMatchesEmailDomain(siteUrl, emailDomains) {
  const host = websiteHostname(siteUrl);
  if (!host || !emailDomains?.length) return false;
  for (const raw of emailDomains) {
    const d = String(raw || '').toLowerCase().replace(/^www\./, '');
    if (!d) continue;
    if (host === d || host.endsWith(`.${d}`)) return true;
  }
  return false;
}

/**
 * Домены-«паразиты» по файлу: встречаются во многих строках (рекламный хвост в выгрузках).
 * Порог: max(15, 2% строк) или абсолют ≥ 40.
 */
function buildParasiteHostSet(contacts, { identityService } = {}) {
  const counts = new Map();
  const rows = Array.isArray(contacts) ? contacts : [];
  let rowsWithSites = 0;

  for (const contact of rows) {
    const raw = collectMappedMulti(contact, [
      'website', 'websites', 'crm_link', 'link', 'url', 'site'
    ]);
    const hosts = new Set();
    for (const item of raw) {
      let url = item;
      if (identityService?.validateContactIdentityValue) {
        const v = identityService.validateContactIdentityValue('website', item);
        if (!v.valid) continue;
        url = v.value;
      } else {
        url = normalizeWebsiteUrl(item);
        if (!url) continue;
      }
      const host = websiteHostname(url);
      if (host) hosts.add(host);
    }
    if (!hosts.size) continue;
    rowsWithSites += 1;
    for (const h of hosts) counts.set(h, (counts.get(h) || 0) + 1);
  }

  const threshold = Math.max(15, Math.ceil(rows.length * 0.02), Math.min(40, Math.ceil(rowsWithSites * 0.05) || 15));
  const parasites = new Set();
  for (const [host, n] of counts) {
    if (n >= threshold || n >= 40) parasites.add(host);
  }
  return { parasites, threshold, rowsWithSites, domainCounts: counts };
}

/**
 * Порядок сайтов для импорта: email-match → не паразит → исходный порядок.
 * Мёртвые URL должны быть отфильтрованы до вызова.
 */
function rankWebsitesForImport(websites, { emails = [], parasiteHosts = null } = {}) {
  const list = [...new Set((websites || []).filter(Boolean))];
  if (list.length <= 1) return list;

  const emailDomains = [...new Set(
    (emails || []).map(emailDomainOf).filter(Boolean)
  )];
  const parasites = parasiteHosts instanceof Set ? parasiteHosts : new Set(parasiteHosts || []);

  return list
    .map((url, index) => {
      const host = websiteHostname(url);
      const emailMatch = websiteMatchesEmailDomain(url, emailDomains);
      const parasite = host ? parasites.has(host) : false;
      let score = 0;
      if (emailMatch) score += 1000;
      if (!parasite) score += 100;
      score += Math.max(0, 50 - index);
      return { url, score, index, emailMatch, parasite };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.url);
}

/**
 * Validate/normalize import identifiers before creating a contact.
 * Returns only usable values; skips junk and duplicates within the row.
 */
function prepareImportIdentities(contact, identityService) {
  const rawEmails = collectMappedMulti(contact, ['email', 'emails']);
  const rawPhones = collectMappedMulti(contact, ['phone', 'phones']);
  const rawWebsites = collectMappedMulti(contact, [
    'website', 'websites', 'crm_link', 'link', 'url', 'site'
  ]);
  const rawTelegrams = collectMappedMulti(contact, ['telegram']);
  const rawWallets = collectMappedMulti(contact, ['wallet']);

  const emails = [];
  const phones = [];
  const websites = [];
  const warnings = [];

  const MAX_EMAILS = 50;
  const MAX_PHONES = 30;
  const MAX_WEBSITES = 10;

  for (const email of rawEmails) {
    const classified = classifyImportEmail(email);
    if (!classified.ok) {
      warnings.push(`email «${email}»: пропуск (${classified.reason})`);
      continue;
    }
    const v = identityService.validateContactIdentityValue('email', classified.email);
    if (v.valid) emails.push(v.value);
    else warnings.push(`email «${email}»: ${v.error}`);
  }
  if (emails.length > MAX_EMAILS) {
    warnings.push(`email: оставлено ${MAX_EMAILS} из ${emails.length}`);
    emails.length = MAX_EMAILS;
  }
  for (const phone of rawPhones) {
    const v = identityService.validateContactIdentityValue('phone', phone);
    if (v.valid) phones.push(v.value);
    else warnings.push(`телефон «${phone}»: ${v.error}`);
  }
  if (phones.length > MAX_PHONES) {
    warnings.push(`телефон: оставлено ${MAX_PHONES} из ${phones.length}`);
    phones.length = MAX_PHONES;
  }
  for (const site of rawWebsites) {
    const v = identityService.validateContactIdentityValue('website', site);
    if (v.valid) websites.push(v.value);
    else warnings.push(`сайт «${site}»: ${v.error}`);
  }
  if (websites.length > MAX_WEBSITES) {
    warnings.push(`сайт: оставлено ${MAX_WEBSITES} из ${websites.length}`);
    websites.length = MAX_WEBSITES;
  }

  let telegram = null;
  if (rawTelegrams[0]) {
    const v = identityService.validateContactIdentityValue('telegram', rawTelegrams[0]);
    if (v.valid) telegram = v.value;
    else warnings.push(`telegram «${rawTelegrams[0]}»: ${v.error}`);
  }

  let wallet = null;
  if (rawWallets[0]) {
    const v = identityService.validateContactIdentityValue('wallet', rawWallets[0]);
    if (v.valid) wallet = v.value;
    else warnings.push(`кошелёк «${rawWallets[0]}»: ${v.error}`);
  }

  return {
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    websites: [...new Set(websites)],
    telegram,
    wallet,
    warnings,
    hasAny: Boolean(emails.length || phones.length || websites.length || telegram || wallet)
  };
}

module.exports = {
  splitMultiValues,
  normalizeWebsiteUrl,
  collectMappedMulti,
  isJunkImportValue,
  classifyImportEmail,
  FREE_EMAIL_DOMAINS,
  prepareImportIdentities,
  websiteHostname,
  emailDomainOf,
  websiteMatchesEmailDomain,
  buildParasiteHostSet,
  rankWebsitesForImport
};
