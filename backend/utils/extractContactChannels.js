/**
 * Extract public emails / phones from HTML and plain text (no JS execution).
 */

const PUBLIC_EMAIL_LOCALS = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon',
  'postmaster', 'webmaster', 'abuse', 'privacy'
]);

function decodeHref(raw) {
  try {
    return decodeURIComponent(String(raw || '').trim());
  } catch {
    return String(raw || '').trim();
  }
}

function normalizeEmailCandidate(raw) {
  const value = String(raw || '').trim().toLowerCase().replace(/^mailto:/i, '');
  const email = value.split('?')[0].trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const local = email.split('@')[0];
  if (PUBLIC_EMAIL_LOCALS.has(local)) return null;
  return email;
}

function normalizePhoneCandidate(raw) {
  let value = decodeHref(String(raw || '').trim()).replace(/^tel:/i, '');
  value = value.split('?')[0].trim();
  const hasPlus = value.startsWith('+');
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return hasPlus ? `+${digits}` : digits;
}

function extractMailtoTelFromHtml(html) {
  const emails = new Set();
  const phones = new Set();
  const re = /href\s*=\s*["']\s*(mailto:|tel:)([^"'>\s]+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const kind = String(m[1] || '').toLowerCase();
    const payload = decodeHref(m[2]);
    if (kind.startsWith('mailto')) {
      const email = normalizeEmailCandidate(payload);
      if (email) emails.add(email);
    } else {
      const phone = normalizePhoneCandidate(payload);
      if (phone) phones.add(phone);
    }
  }
  return { emails: [...emails], phones: [...phones] };
}

function extractEmailsFromText(text) {
  const found = new Set();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const email = normalizeEmailCandidate(m[0]);
    if (email) found.add(email);
  }
  return [...found];
}

function extractPhonesFromText(text) {
  const found = new Set();
  // Prefer international-looking numbers; avoid short codes
  const re = /(?:\+|00)?[\d][\d\s().-]{6,18}\d/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const phone = normalizePhoneCandidate(m[0]);
    if (phone) found.add(phone);
  }
  return [...found];
}

/**
 * @param {string} html
 * @param {string} [plainText]
 * @param {{ maxEmails?: number, maxPhones?: number }} [limits]
 */
function extractContactChannels(html, plainText = '', limits = {}) {
  const maxEmails = Math.min(20, Math.max(1, Number(limits.maxEmails) || 10));
  const maxPhones = Math.min(20, Math.max(1, Number(limits.maxPhones) || 10));
  const fromHref = extractMailtoTelFromHtml(html);
  const text = plainText || '';
  const emails = [...new Set([...fromHref.emails, ...extractEmailsFromText(text)])].slice(0, maxEmails);
  const phones = [...new Set([...fromHref.phones, ...extractPhonesFromText(text)])].slice(0, maxPhones);
  return { emails, phones };
}

module.exports = {
  extractContactChannels,
  normalizeEmailCandidate,
  normalizePhoneCandidate,
  extractMailtoTelFromHtml
};
