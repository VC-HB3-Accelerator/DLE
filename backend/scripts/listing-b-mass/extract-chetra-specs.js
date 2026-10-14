'use strict';

const CHETRA_BASE = 'https://www.chetra.ru';

/** Кириллическая модель → путь на chetra.ru */
function chetraSlugForModel(model) {
  const m = String(model || '').trim();
  if (/^Т\d/i.test(m)) {
    const num = m.replace(/^Т/i, '');
    return `/catalog/buldozers/chetra-t${num.toLowerCase()}/`;
  }
  if (/^ТГ/i.test(m)) {
    const num = m.replace(/^ТГ/i, '');
    return `/catalog/pipelayers/chetra-tg${num.toLowerCase()}/`;
  }
  if (/^Е/i.test(m)) {
    const tail = m.replace(/^Е/i, '').trim().replace(/\s+/g, ' ').toLowerCase();
    const slug = tail.replace(/\s+nc$/i, '-nc').replace(/\s+/g, '-');
    return `/catalog/excavator/chetra-e${slug}/`;
  }
  if (/^ПК/i.test(m)) {
    const num = m.replace(/^ПК/i, '');
    return `/catalog/wheels/chetra-pk${num.toLowerCase()}/`;
  }
  if (/^ТК/i.test(m)) {
    return '/catalog/wheels/chetra-tk-25/';
  }
  if (/^СИТИ/i.test(m)) {
    if (/3C/i.test(m)) return '/catalog/backhoe/chetra-city-3c/';
    return '/catalog/backhoe/chetra-city-3c/';
  }
  return null;
}

function resolveChetraUrl(model, sourceUrl) {
  const url = String(sourceUrl || '').trim();
  if (url && !/\/catalog\/?$/.test(url.replace(/\/$/, ''))) {
    return url;
  }
  const slug = chetraSlugForModel(model);
  if (!slug) return url || `${CHETRA_BASE}/catalog/`;
  return `${CHETRA_BASE}${slug}`;
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseTableSpecs(html) {
  const specs = new Map();
  const rows = String(html).match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<p>\s*([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1]));
    if (cells.length < 2) continue;
    const label = cells[0];
    const value = cells.slice(1).filter(Boolean).join(' / ').trim();
    if (label && value && label.length < 120) {
      specs.set(label, value);
    }
  }
  return specs;
}

function typeFromChetraPath(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('/buldozers/')) return 'бульдозер';
  if (u.includes('/excavator/')) return 'гусеничный экскаватор';
  if (u.includes('/pipelayers/')) return 'трубоукладчик';
  if (u.includes('/backhoe/')) return 'экскаватор-погрузчик';
  if (u.includes('/wheels/')) return 'колёсный погрузчик';
  return null;
}

function pickChetraSegments(specsMap, h1, pageUrl) {
  const segments = [];
  const pathType = typeFromChetraPath(pageUrl);
  if (pathType) segments.push(pathType);
  const h = String(h1 || '').toLowerCase();
  if (!pathType && /бульдозер/.test(h)) segments.push('бульдозер');
  if (/экскаватор-погрузчик|экскаватор погрузчик/.test(h)) segments.push('экскаватор-погрузчик');
  else if (/экскаватор/.test(h) && !/погрузчик/.test(h)) segments.push('гусеничный экскаватор');
  if (/фронтальный погрузчик/.test(h)) segments.push('фронтальный погрузчик');
  else if (/погрузчик/.test(h) && /колёс/.test(h)) segments.push('колёсный погрузчик');
  if (/трубоукладчик/.test(h)) segments.push('трубоукладчик');

  const power = specsMap.get('Мощность номинальная, кВт (л.с.)')
    || specsMap.get('Мощность номинальная, ЯМЗ/QSB6.7/Weichai, кВт (л.с.)')
    || specsMap.get('Мощность номинальная, ЯМЗ, кВт (л.с.)');
  if (power) {
    const norm = power.replace(/\s+/g, ' ').trim();
    segments.push(`${norm} кВт (л.с.)`);
  }
  const mass = specsMap.get('Эксплуатационная масса, т*')
    || specsMap.get('Эксплуатационная масса, т');
  if (mass) {
    segments.push(`эксплуатационная масса ${mass} т`);
  }
  return segments;
}

function extractChetraFromHtml(html, brand, model, pageUrl = '') {
  const title = (html.match(/<title>([^<]+)/i) || [])[1] || '';
  const h1 = (html.match(/<h1[^>]*>([^<]+)/i) || [])[1] || title.split('|')[0].trim();
  const specsMap = parseTableSpecs(html);
  let segments = pickChetraSegments(specsMap, h1, pageUrl);
  if (!segments.length) {
    let typeWord = h1.replace(new RegExp(brand, 'i'), '').replace(new RegExp(model, 'i'), '').trim();
    typeWord = typeWord.replace(/\s+/g, ' ').replace(/^[-–—·\s]+/, '');
    if (typeWord && !/^каталог техники$/i.test(typeWord)) {
      segments.push(typeWord);
    }
  }
  segments = segments.filter((s) => s && !/^мощность кВт$/i.test(s));
  return { h1, title, segments, sourceUrl: null };
}

module.exports = {
  resolveChetraUrl,
  chetraSlugForModel,
  extractChetraFromHtml,
  parseTableSpecs,
};
