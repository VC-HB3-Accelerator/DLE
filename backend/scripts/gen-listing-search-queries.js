'use strict';

/**
 * Каскад: LLM только enrichQuery + короткие baseHints + хвосты (bucket+tail).
 * Финальные photo-q собирает listing-b-mass/listing-photo-search-b-host.mjs из searchBase.
 */
const { resolveRole } = require('/app/services/orchModelRouter');

const QUERY_MODEL = process.env.QUERY_GEN_MODEL || 'qwen3.8-max';

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { buf += c; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(buf || '{}')); } catch (e) { reject(e); }
    });
    process.stdin.on('error', reject);
  });
}

function defaultTails(row) {
  const hint = String(row.description || '');
  const desc0 = hint.split(';')[0].toLowerCase();
  const tails = [
    { bucket: 'front34', tail: 'ракурс три четверти' },
    { bucket: 'front', tail: 'вид спереди' },
    { bucket: 'side', tail: 'вид сбоку профиль' },
    { bucket: 'rear', tail: 'вид сзади' },
    { bucket: 'detail', tail: 'шильда модель табличка' },
    { bucket: 'work', tail: 'рабочая зона' },
    { bucket: 'cabin', tail: 'кабина салон пульт' },
    { bucket: 'any', tail: 'общий план пресс-фото' },
  ];
  if (row.segment === 'premium') {
    return [
      { bucket: 'front34', tail: 'ракурс три четверти' },
      { bucket: 'rear', tail: 'вид сзади' },
      { bucket: 'side', tail: 'профиль' },
      { bucket: 'front', tail: 'вид спереди' },
      { bucket: 'cabin', tail: 'салон водитель' },
      { bucket: 'cabin', tail: 'салон задний ряд багажник' },
      { bucket: 'detail', tail: 'приборная панель экран' },
      { bucket: 'detail', tail: 'деталь колесо' },
    ];
  }
  if (row.segment === 'spectehnika') {
    return [
      { bucket: 'front34', tail: 'ракурс три четверти' },
      { bucket: 'side', tail: 'вид сбоку' },
      { bucket: 'rear', tail: 'вид сзади' },
      { bucket: 'work', tail: 'ковш стрела рабочий орган' },
      { bucket: 'cabin', tail: 'кабина оператора' },
      { bucket: 'detail', tail: 'гусеницы мост ходовая' },
      { bucket: 'work', tail: 'рабочее положение стрела' },
      { bucket: 'any', tail: 'официальное пресс-фото' },
    ];
  }
  if (row.segment === 'oborudovanie') {
    if (/комбайн|трактор|жатк|сельхоз/i.test(desc0)) {
      return [
        { bucket: 'front34', tail: 'комбайн трактор три четверти' },
        { bucket: 'side', tail: 'профиль жатка платформа' },
        { bucket: 'rear', tail: 'вид сзади бункер' },
        { bucket: 'work', tail: 'жатка header крупно' },
        { bucket: 'cabin', tail: 'кабина' },
        { bucket: 'detail', tail: 'мост колеса' },
        { bucket: 'any', tail: 'в поле общий план' },
        { bucket: 'detail', tail: 'модель декаль' },
      ];
    }
    if (/станок|лазер|гиб|токар|фрез|плазм|cut|press brake/i.test(desc0)) {
      return [
        { bucket: 'front34', tail: 'станок три четверти' },
        { bucket: 'front', tail: 'панель управления' },
        { bucket: 'work', tail: 'зона обработки стол' },
        { bucket: 'work', tail: 'лазерная голова гибка' },
        { bucket: 'side', tail: 'вид сбоку' },
        { bucket: 'detail', tail: 'шильда модели' },
        { bucket: 'cabin', tail: 'пульт ЧПУ монитор' },
        { bucket: 'any', tail: 'официальное фото' },
      ];
    }
    if (/кт|tomograph|health|медиц|mri|somatom/i.test(desc0)) {
      return [
        { bucket: 'any', tail: 'аппарат целиком' },
        { bucket: 'front', tail: 'гантри туннель' },
        { bucket: 'work', tail: 'стол пациента' },
        { bucket: 'cabin', tail: 'пульт оператора' },
        { bucket: 'detail', tail: 'консоль мониторы' },
        { bucket: 'any', tail: 'кабинет установка' },
        { bucket: 'detail', tail: 'логотип модель' },
        { bucket: 'side', tail: 'вид сбоку' },
      ];
    }
  }
  return tails.slice(0, 8);
}

function fallbackPlan(row) {
  const product = `${row.brand} ${row.model}`.replace(/\s+/g, ' ').trim();
  return {
    enrichQuery: `${row.title?.replace(/\s*·\s*/g, ' ') || product} официальные характеристики`,
    baseHints: [],
    tails: defaultTails(row),
    source: 'fallback',
  };
}

function normalizePlan(parsed, row) {
  const product = `${row.brand} ${row.model}`.replace(/\s+/g, ' ').trim();
  const enrichQuery = String(
    parsed.enrichQuery || `${row.title?.replace(/\s*·\s*/g, ' ') || product} официальные характеристики`,
  ).trim().slice(0, 120);

  let baseHints = Array.isArray(parsed.baseHints)
    ? parsed.baseHints.map((s) => String(s).trim()).filter(Boolean)
    : [];
  baseHints = baseHints.slice(0, 3).map((h) => h.slice(0, 36));

  let tails = Array.isArray(parsed.tails) ? parsed.tails : defaultTails(row);
  tails = tails
    .filter((t) => t && (t.tail === '' || t.tail))
    .map((t) => ({
      bucket: String(t.bucket || 'any'),
      tail: String(t.tail ?? '').trim(),
    }));

  const seen = new Set();
  tails = tails.filter((t) => {
    const k = `${t.bucket}:${t.tail}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (tails.length < 8) {
    for (const t of defaultTails(row)) {
      const k = `${t.bucket}:${t.tail}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      tails.push(t);
    }
  }

  return {
    enrichQuery,
    baseHints,
    tails: tails.slice(0, 8),
    source: parsed.source || 'llm',
  };
}

async function llmPlan(row, model) {
  const route = await resolveRole('brief_chat');
  const root = String(route.baseUrl).replace(/\/+$/, '');
  const useModel = model || route.model;

  const system = [
    'Каскад поиска фото для объявления (8 разных ракурсов). JSON без markdown:',
    '{"enrichQuery":"короткий запрос характеристик",',
    '"baseHints":["1-3 тип из description"],',
    '"tails":[{"bucket":"front34|front|side|rear|work|cabin|detail|any","tail":"короткий хвост"}]}',
    'Ровно 8 tails — разные ракурсы: 3/4, профиль, сзади, рабочая зона, кабина/салон, деталь/шильда, общий план.',
    'Не дублируй brand+model в tail. segment: premium=легковой; gruzoviki=грузовик/тягач;',
    'spectehnika=экскаватор/погрузчик/кран; oborudovanie=станок/комбайн/КТ/агрегат — ракурсы под тип из description.',
  ].join(' ');

  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: useModel,
      temperature: 0.15,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({
          title: row.title,
          brand: row.brand,
          model: row.model,
          segment: row.segment,
          description: row.description,
        }, null, 2) },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || data.message || `LLM HTTP ${res.status}`);
  }
  const text = data.choices?.[0]?.message?.content || '';
  const match = String(text).match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON in LLM response: ${text.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  parsed.source = 'llm';
  return normalizePlan(parsed, row);
}

async function main() {
  const input = await readStdin();
  const row = input.row;
  if (!row?.brand || !row?.model) {
    process.stdout.write(JSON.stringify({ error: 'missing row.brand/model' }));
    process.exit(1);
  }
  const model = input.model || QUERY_MODEL;
  try {
    const plan = await llmPlan(row, model);
    process.stdout.write(JSON.stringify(plan));
  } catch (e) {
    const plan = fallbackPlan(row);
    plan.llmError = String(e.message || e).slice(0, 200);
    process.stdout.write(JSON.stringify(plan));
  }
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ error: String(e.message || e) }));
  process.exit(1);
});
