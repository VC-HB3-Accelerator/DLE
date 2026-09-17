/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Известные публичные / consumer webmail домены.
 * Регистрация с них запрещена. Корп. домены задаются отдельно в auth_email_domain_rules.
 */

function normalizeDomain(value) {
  let v = String(value || '').trim().toLowerCase();
  if (v.startsWith('@')) v = v.slice(1);
  if (v.endsWith('.')) v = v.slice(0, -1);
  return v;
}

/**
 * Семейства, у которых публичные ящики на любых национальных TLD:
 * ivan@yahoo.co.uk, ivan@hotmail.fr, ivan@yandex.by
 * Первая метка домена = имя провайдера (yahoo.co.uk → yahoo).
 */
const PUBLIC_EMAIL_FAMILIES = new Set([
  'gmail',
  'googlemail',
  'yahoo',
  'ymail',
  'rocketmail',
  'hotmail',
  'outlook',
  'live',
  'msn',
  'yandex',
  'rambler',
  'protonmail',
  'gmx',
  'aol',
  'icloud',
]);

/** Известные публичные почты для UI и явной блокировки (CIS + мировые провайдеры). */
const NOTABLE_PUBLIC_EMAIL_DOMAINS = [
  // Google
  'gmail.com', 'googlemail.com', 'google.com',
  // Microsoft
  'outlook.com', 'outlook.ru', 'hotmail.com', 'hotmail.ru', 'live.com', 'live.ru',
  'msn.com', 'passport.com',
  // Yahoo
  'yahoo.com', 'ymail.com', 'rocketmail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Mail.ru Group
  'mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru', 'mail.ua', 'email.ru', 'xmail.ru',
  // Yandex
  'ya.ru', 'yandex.ru', 'yandex.com', 'yandex.net', 'yandex.by', 'yandex.kz', 'yandex.ua',
  'yandex.uz', 'yandex.az', 'yandex.eu', 'yandex.fr', 'yandex.com.tr',
  // Rambler
  'rambler.ru', 'autorambler.ru', 'myrambler.ru', 'lenta.ru', 'ro.ru', 'r0.ru', 'rambler.ua',
  'auto.ru',
  // СНГ / Восточная Европа
  'ukr.net', 'i.ua', 'meta.ua', 'bigmir.net', 'email.ua', 'ua.fm', 'online.ua', 'inbox.com.ua',
  'tut.by', 'mail.by',
  'qip.ru', 'pochta.ru', 'fromru.com', 'newmail.ru', 'nightmail.ru', 'nm.ru', 'pop3.ru',
  'smtp.ru', 'front.ru', 'hotbox.ru', 'km.ru', 'land.ru', 'love.ru', 'pisem.net', 'narod.ru',
  'chat.ru', 'e-mail.ru', 'mail333.com', 'e1.ru', '66.ru', 'ngs.ru',
  // Proton / privacy
  'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me', 'tutanota.com', 'tuta.com',
  'tutamail.com', 'mailbox.org', 'posteo.de', 'disroot.org',
  // Zoho / Fastmail
  'zoho.com', 'zohomail.com', 'zoho.eu', 'fastmail.com', 'fastmail.fm',
  // GMX / WEB.DE / mail.com
  'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'gmx.fr', 'gmx.ru', 'web.de', 'mail.com',
  // AOL / legacy US
  'aol.com', 'aim.com', 'netscape.net', 'cs.com',
  // Китай
  'qq.com', 'foxmail.com', '163.com', '126.com', 'yeah.net', 'sina.com', 'sina.cn', 'sohu.com',
  '139.com', '189.cn', 'aliyun.com', '21cn.com',
  // Индия / Азия
  'rediffmail.com', 'rediff.com', 'naver.com', 'daum.net', 'hanmail.net', 'nate.com',
  // Германия / ISP
  't-online.de', 'freenet.de', 'arcor.de', 'online.de',
  // Франция / ISP
  'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'neuf.fr', 'club-internet.fr',
  // UK / ISP
  'btinternet.com', 'sky.com', 'virginmedia.com', 'blueyonder.co.uk', 'ntlworld.com', 'talktalk.net',
  // Италия
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it', 'tiscali.it', 'email.it',
  // Испания / Португалия
  'terra.es', 'telefonica.net', 'ya.com', 'sapo.pt', 'clix.pt',
  // Польша / Чехия
  'wp.pl', 'onet.pl', 'interia.pl', 'o2.pl', 'gazeta.pl', 'op.pl',
  'seznam.cz', 'email.cz', 'post.cz', 'centrum.cz', 'atlas.cz',
  // Бразилия
  'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com',
  // США ISP
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
  'charter.net', 'earthlink.net', 'juno.com', 'netzero.net', 'optonline.net', 'ameritech.net',
  'prodigy.net', 'frontier.com', 'windstream.net', 'centurylink.net',
  // Канада / Австралия
  'shaw.ca', 'rogers.com', 'sympatico.ca', 'telus.net', 'videotron.ca',
  'bigpond.com', 'bigpond.net.au', 'optusnet.com.au', 'tpg.com.au',
  // Прочие популярные
  'inbox.com', 'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
];

const notableSet = new Set(NOTABLE_PUBLIC_EMAIL_DOMAINS.map(normalizeDomain));

function isPublicEmailFamily(domain) {
  const d = normalizeDomain(domain);
  if (!d || !d.includes('.')) return false;
  const head = d.split('.')[0];
  return PUBLIC_EMAIL_FAMILIES.has(head);
}

function isPublicEmailDomain(domain) {
  const d = normalizeDomain(domain);
  if (!d) return false;
  if (notableSet.has(d)) return true;
  return isPublicEmailFamily(d);
}

function listNotablePublicEmailDomains() {
  return [...notableSet].sort();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeDomain,
    PUBLIC_EMAIL_FAMILIES,
    NOTABLE_PUBLIC_EMAIL_DOMAINS,
    isPublicEmailDomain,
    isPublicEmailFamily,
    listNotablePublicEmailDomains,
  };
}

export {
  normalizeDomain,
  PUBLIC_EMAIL_FAMILIES,
  NOTABLE_PUBLIC_EMAIL_DOMAINS,
  isPublicEmailDomain,
  isPublicEmailFamily,
  listNotablePublicEmailDomains,
};
