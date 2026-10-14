'use strict';

/**
 * Убирает маркетинговый шум из description/summary карточек каталога (гео, витрины, цены, дилеры).
 */

const DROP_SEGMENT_RE = [
  /^казахстан$/i,
  /^оаэ$/i,
  /официальный showroom rolls-royce/i,
  /витрины ae\/kz\/by\/am\/rs/i,
  /модель в официальном каталоге models/i,
  /модель в официальном модельном ря/i,
  /в официальном модельном ря/i,
  /модель на официальной витрине/i,
  /модель официальной витрины/i,
  /вариант на витрине/i,
  /на витрине/i,
  /porsche kazakhstan/i,
  /bmw kazakhstan/i,
  /genesis kazakhstan/i,
  /genesis auto kazakhstan/i,
  /astana motors/i,
  /autocenter-bavaria/i,
  /zeekr авилон/i,
  /модель на витрине aud/i,
  /главная витрина volvo/i,
  /^от\s+[\d\s~.]+\s*(тг|₸|₽|aed|руб\.?)/i,
  /^[\d\s~.]+\s*(тг|₸|₽)\s*(на витрине|\(|$)/i,
  /^\(?на витрине также/i,
  /^\d[\d\s~.]*\s*(тг|₸|₽)/i,
  /\(с учётом.*выгод/i,
  /прайс\/брошюра на официальном сайте/i,
  /глобальный каталог daf/i,
  /^глобальный каталог/i,
  /модель на главной витрине/i,
  /цифры мощности с карточки сайта не сняты/i,
  /официальном pdf-каталоге/i,
  /региональные kz\/by без актуального/i,
  /без полноценного открытого модельного ря/i,
  /региональные kz\/by\/am\/ae\/rs/i,
  /new generation(\s*\(флагман\))?$/i,
  /^мощность кВт$/i,
  /^ковш м³$/i,
  /^магистральный тягач/i,
  /^дистрибуция\/шасси/i,
  /^городской\/среднетоннажник/i,
  /^строительный\/off-road/i,
];

function isGenericBodySegment(segment) {
  const t = segment.trim();
  if (!t) return true;
  if (/^(внедорожник|электрокроссовер|кроссовер|седан|купе|хэтчбек|минивэн|электрокупе|shooting brake)$/i.test(t)) return true;
  if (/^кросс-купе\s+[a-z0-9]/i.test(t) && t.length <= 40) return true;
  if (
    /^(внедорожник|электрокроссовер|кроссовер|седан|купе|хэтчбек|минивэн|suv)\s+/i.test(t)
    && t.length <= 48
    && !/л\.?\s*с|квт|×|\d\s*[-–—]\s*\d|м\/ч|т\/ч|тонн|мм|кг/i.test(t)
    && !/^(полно|спорт|флагман|компакт|средн|мал|гибридный|электрическ|plug-in|mild)/i.test(t)
  ) {
    return true;
  }
  return false;
}

function shouldDropMarketingSegment(segment) {
  const s = segment.trim();
  if (!s) return true;
  for (const re of DROP_SEGMENT_RE) {
    if (re.test(s)) return true;
  }
  return false;
}

function shouldDropSegment(segment) {
  const s = segment.trim();
  if (!s) return true;
  if (shouldDropMarketingSegment(s)) return true;
  if (isGenericBodySegment(s)) return true;
  return false;
}

function removeShassiWord(raw) {
  let s = String(raw || '');
  if (!/шасси/i.test(s)) return s;
  s = s.replace(/\s+на\s+шасси\s+/gi, ' ');
  s = s.replace(/—\s*шасси\s*;?\s*/gi, '— ');
  s = s.replace(/шасси/gi, '');
  s = s.replace(/\s{2,}/g, ' ');
  s = s.replace(/;\s*;/g, ';');
  s = s.replace(/—\s*—/g, '—');
  s = s.replace(/\s+;/g, ';');
  s = s.replace(/;\s+/g, '; ');
  return s.trim();
}

function sanitizeListingSummary(raw, fallbackTitle = '') {
  const input = String(raw || '').trim();
  if (!input) return '';

  const parts = input.split(';').map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => !shouldDropSegment(p));
  let out = kept.join('; ').replace(/\s+/g, ' ').trim();

  out = out.replace(/^;\s*|;\s*$/g, '').trim();
  if (!out) out = String(fallbackTitle || '').trim();
  return removeShassiWord(out);
}

module.exports = {
  sanitizeListingSummary,
  removeShassiWord,
  shouldDropSegment,
  shouldDropMarketingSegment,
  isGenericBodySegment,
};
