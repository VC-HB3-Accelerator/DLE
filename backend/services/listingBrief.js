'use strict';

/**
 * Soft-ask brief: color from config; generation/year options via LLM (+ generic fallback).
 */
const fs = require('fs');
const path = require('path');

const COLOR_OPTIONS = [
  { id: 'white', label: 'Белый', query: 'белый white' },
  { id: 'black', label: 'Чёрный', query: 'чёрный black' },
  { id: 'silver', label: 'Серебристый', query: 'серебристый silver' },
  { id: 'grey', label: 'Серый', query: 'серый grey gray' },
  { id: 'blue', label: 'Синий', query: 'синий blue' },
  { id: 'red', label: 'Красный', query: 'красный red' },
  { id: 'any', label: 'Не важно', query: '' },
];

const ANY_GEN = { id: 'any', label: 'Не важно / любая', query: '' };

/** Generic year buckets — only used if LLM unavailable. No brand-specific hardcode. */
function fallbackGenerationOptions() {
  return [
    { id: 'gen_new', label: 'Новее ~2018', query: '2018 2019 2020 2021 2022 2023 2024' },
    { id: 'gen_mid', label: '2010–2017', query: '2010 2012 2015 2017' },
    { id: 'gen_old', label: 'До 2010', query: '2005 2008 2009' },
    { ...ANY_GEN },
  ];
}

function extractFromPrompt(text) {
  const t = String(text || '');
  const out = { generation: null, color: null, year: null };

  const yearM = t.match(/\b((?:19|20)\d{2})\b/);
  if (yearM) {
    out.year = yearM[1];
    out.generation = `y${yearM[1]}`;
  }

  if (/бел(ый|ая|ое)|white/i.test(t)) out.color = 'white';
  else if (/чёрн|черн|black/i.test(t)) out.color = 'black';
  else if (/серебр|silver/i.test(t)) out.color = 'silver';
  else if (/сер(ый|ая|ое)|grey|gray/i.test(t)) out.color = 'grey';
  else if (/син(ий|яя|ее)|blue/i.test(t)) out.color = 'blue';
  else if (/красн|red/i.test(t)) out.color = 'red';

  return out;
}

function needsBrief(brand, model, userPrompt, existingBrief) {
  if (existingBrief?.answered) return false;
  if (/без уточнен|не уточня|сразу ищи|любая модель|любой цвет/i.test(String(userPrompt || ''))) {
    return false;
  }
  const extracted = extractFromPrompt(userPrompt);
  if ((extracted.year || extracted.generation) && extracted.color) return false;
  return true;
}

function slugId(s, i) {
  const base = String(s || '')
    .toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[^a-z0-9а-я]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || `opt_${i + 1}`;
}

function normalizeGenOptions(rawList) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(rawList) ? rawList : [];
  for (let i = 0; i < list.length && out.length < 5; i++) {
    const item = list[i] || {};
    const label = String(item.label || item.name || '').trim();
    if (!label) continue;
    let id = String(item.id || slugId(label, i)).trim().toLowerCase();
    if (id === 'any' || /не важно|любая|any/i.test(label)) {
      id = 'any';
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: label.slice(0, 80),
      query: String(item.query || item.search || label)
        .replace(/не важно|любая|any/gi, '')
        .trim()
        .slice(0, 120),
    });
  }
  if (!seen.has('any')) out.push({ ...ANY_GEN });
  if (out.length < 2) return fallbackGenerationOptions();
  return out;
}

function orchRoot() {
  const candidates = [
    '/host-project/orchestrator',
    path.join(__dirname, '../../orchestrator'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, 'runtime/llm.js'))) return p;
  }
  return null;
}

function loadOrchLlm() {
  const root = orchRoot();
  if (!root) return null;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(root, 'runtime/llm.js'));
  } catch {
    return null;
  }
}

/**
 * Ask LLM for 3–5 generation/year options for brand+model.
 * Prefers Settings (qwencloud) via orchProviderBridge; fallback generic years.
 */
async function resolveGenerationOptions(brand, model, userPrompt) {
  const system = `You help a marketplace photo agent clarify vehicle/equipment identity.
Return ONLY JSON (no markdown):
{
  "prompt": "short question in Russian",
  "options": [
    { "id": "slug_en", "label": "human label RU with years if known", "query": "search keywords ru+en for image search" }
  ]
}
Rules:
- 3 to 5 options for generations / body series / year ranges of THIS brand+model.
- Use real known generations when you know them; otherwise year ranges.
- Always include last option id "any" label "Не важно / любая" query "".
- Labels in Russian. ids: latin slug. query: words that improve Bing/Yandex image search.
- Works for cars, trucks, and industrial equipment.`;

  const user = JSON.stringify({
    brand,
    model,
    user_prompt: String(userPrompt || '').slice(0, 400),
  });

  // 1) Live Settings via model router (role: brief_chat)
  try {
    const router = require('./orchModelRouter');
    const res = await router.chatForRole(
      'brief_chat',
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 0.2, maxTokens: 800, json: true }
    );
    const parsed = (res.parseJsonLoose || loadOrchLlm()?.parseJsonLoose)?.(res.content) || {};
    const options = normalizeGenOptions(parsed.options);
    return {
      options,
      source: `${res.route?.source || 'router'}:${res.route?.provider}:${res.route?.model}`,
      prompt:
        String(parsed.prompt || '').trim() ||
        `Уточните «${brand} ${model}»: поколение/годы и цвет кузова.`,
    };
  } catch (e1) {
    // 2) Lab env orch llm
    const llm = loadOrchLlm();
    if (llm) {
      const providers = [
        process.env.ORCH_BRIEF_PROVIDER,
        process.env.ORCH_VISION_PROVIDER,
        'qwen_token',
        'qwen_paygo',
        'deepseek',
      ].filter(Boolean);
      let lastErr = e1;
      for (const name of providers) {
        try {
          const res = await llm.chatWith(
            name,
            [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            { temperature: 0.2, maxTokens: 800, json: true }
          );
          const parsed = llm.parseJsonLoose(res.content) || {};
          return {
            options: normalizeGenOptions(parsed.options),
            source: `llm:${name}`,
            prompt:
              String(parsed.prompt || '').trim() ||
              `Уточните «${brand} ${model}»: поколение/годы и цвет кузова.`,
          };
        } catch (e) {
          lastErr = e;
        }
      }
      return {
        options: fallbackGenerationOptions(),
        source: `fallback:${lastErr?.message || 'llm_failed'}`,
        prompt: `Уточните «${brand} ${model}»: поколение/годы и цвет кузова.`,
      };
    }
    return {
      options: fallbackGenerationOptions(),
      source: `fallback:${e1.message || 'no_provider'}`,
      prompt: `Уточните «${brand} ${model}»: поколение/годы и цвет кузова.`,
    };
  }
}

async function buildBrief(brand, model, userPrompt) {
  const extracted = extractFromPrompt(userPrompt);
  const resolved = await resolveGenerationOptions(brand, model, userPrompt);
  let gens = resolved.options;
  if (extracted.year && !gens.some((o) => o.id === `y${extracted.year}`)) {
    gens = [
      {
        id: `y${extracted.year}`,
        label: `${extracted.year} год`,
        query: String(extracted.year),
      },
      ...gens.filter((o) => o.id !== 'any'),
      ANY_GEN,
    ].slice(0, 6);
  }
  return {
    question_id: 'brief_identity',
    prompt:
      resolved.prompt ||
      `Уточните «${brand} ${model}»: поколение/годы и цвет кузова — так поиск и генерация будут точнее.`,
    fields: [
      {
        id: 'generation',
        label: 'Поколение / годы',
        options: gens,
        selected: extracted.generation || (extracted.year ? `y${extracted.year}` : null),
      },
      {
        id: 'color',
        label: 'Цвет кузова',
        options: COLOR_OPTIONS,
        selected: extracted.color || null,
      },
    ],
    extracted,
    options_source: resolved.source || 'unknown',
  };
}

/** Sync fallback for rare call sites that cannot await. Prefer buildBrief. */
function buildBriefSync(brand, model, userPrompt) {
  const extracted = extractFromPrompt(userPrompt);
  return {
    question_id: 'brief_identity',
    prompt: `Уточните «${brand} ${model}»: поколение/годы и цвет кузова.`,
    fields: [
      {
        id: 'generation',
        label: 'Поколение / годы',
        options: fallbackGenerationOptions(),
        selected: extracted.generation || null,
      },
      {
        id: 'color',
        label: 'Цвет кузова',
        options: COLOR_OPTIONS,
        selected: extracted.color || null,
      },
    ],
    extracted,
    options_source: 'fallback_sync',
  };
}

function applyBriefAnswers(brief, answers, brand, model) {
  const a = answers && typeof answers === 'object' ? answers : {};
  let genOpts = (brief?.fields || []).find((f) => f.id === 'generation')?.options || [];
  if (!genOpts.length) genOpts = fallbackGenerationOptions();
  const colorOpts = COLOR_OPTIONS;
  const generation = String(a.generation || brief?.extracted?.generation || 'any');
  const color = String(a.color || brief?.extracted?.color || 'any');
  const year = a.year || brief?.extracted?.year || null;
  const genMeta =
    genOpts.find((o) => o.id === generation) ||
    genOpts.find((o) => o.id === 'any') ||
    ANY_GEN;
  const colorMeta =
    colorOpts.find((o) => o.id === color) ||
    colorOpts.find((o) => o.id === 'any');
  return {
    answered: true,
    generation: genMeta.id || generation,
    color: colorMeta?.id || color,
    year,
    generation_query: genMeta.query || (year ? String(year) : ''),
    color_query: colorMeta?.query || '',
    labels: {
      generation: genMeta.label || generation,
      color: colorMeta?.label || color,
    },
  };
}

function briefQueryExtras(briefData) {
  if (!briefData) return '';
  const parts = [];
  if (briefData.year) parts.push(String(briefData.year));
  if (briefData.generation_query) parts.push(briefData.generation_query);
  if (briefData.color_query) parts.push(briefData.color_query);
  return parts.filter(Boolean).join(' ').trim();
}

module.exports = {
  COLOR_OPTIONS,
  fallbackGenerationOptions,
  /** @deprecated use fallbackGenerationOptions / resolveGenerationOptions */
  generationOptions: fallbackGenerationOptions,
  resolveGenerationOptions,
  extractFromPrompt,
  needsBrief,
  buildBrief,
  buildBriefSync,
  applyBriefAnswers,
  briefQueryExtras,
};
