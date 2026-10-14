'use strict';
const db = require('../db');

const patterns = [
  ['geo_kz', /казахстан|kazakhstan|оаэ|ae\/kz|by\/am/i],
  ['vitrina', /витрин|showroom|официальн.*каталог|модельн.*ряд/i],
  ['price', /от\s+[\d\s~.]+\s*(тг|₸|₽|aed)|\d[\d\s]{4,}\s*(тг|₸|₽)/i],
  ['dealer', /avilon|astana|motors|дилер|autocenter|porsche kazakhstan/i],
  ['global_catalog', /глобальный каталог/i],
  ['new_gen', /new generation|флагман\)/i],
  ['region_note', /региональн.*kz|без полноценного|не открылись/i],
  ['url_in_text', /https?:\/\//i],
];

(async () => {
  const { rows } = await db.getQuery()(
    `SELECT id, title, summary FROM admin_pages_simple WHERE category = '2026' ORDER BY id`,
  );

  const titleOnly = rows.filter((r) => (r.summary || '').trim() === (r.title || '').trim());
  const empty = rows.filter((r) => !(r.summary || '').trim());
  const veryShort = rows.filter((r) => {
    const s = (r.summary || '').trim();
    return s && s !== (r.title || '').trim() && s.length <= 22;
  });

  const hits = {};
  for (const [key] of patterns) hits[key] = [];
  for (const r of rows) {
    const s = String(r.summary || '');
    for (const [key, re] of patterns) {
      if (re.test(s)) hits[key].push(r);
    }
  }

  const junkWords = rows.filter((r) => {
    const s = (r.summary || '').trim();
    if (!s || s === r.title) return false;
    return /^(линейка|модель|кроссовер|седан|купе|шасси|тягач|грузовик|самосвал)\s*[;.]?\s*$/i.test(s)
      || /^линейка\s+\w+$/i.test(s);
  });

  console.log(JSON.stringify({
    total: rows.length,
    summary_equals_title: titleOnly.length,
    summary_empty: empty.length,
    summary_very_short_le22: veryShort.length,
    pattern_counts: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])),
    junk_one_liner: junkWords.length,
  }, null, 2));

  const sample = (arr, n = 8) => arr.slice(0, n).map((r) => ({
    id: r.id,
    title: r.title,
    summary: (r.summary || '').slice(0, 140),
  }));

  console.log('\nTITLE_ONLY_SAMPLE', JSON.stringify(sample(titleOnly, 15), null, 2));
  console.log('\nVERY_SHORT', JSON.stringify(sample(veryShort, 20), null, 2));
  console.log('\nJUNK_ONE_LINER', JSON.stringify(sample(junkWords, 15), null, 2));

  for (const [key, arr] of Object.entries(hits)) {
    if (!arr.length) continue;
    console.log(`\nPATTERN_${key}`, JSON.stringify(sample(arr, 8), null, 2));
  }

  const segCount = new Map();
  for (const r of rows) {
    const s = (r.summary || '').trim();
    if (!s || s === r.title) continue;
    const first = s.split(';')[0].trim().slice(0, 70);
    segCount.set(first, (segCount.get(first) || 0) + 1);
  }
  const topSeg = [...segCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log('\nTOP_FIRST_SEGMENTS', JSON.stringify(topSeg, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
