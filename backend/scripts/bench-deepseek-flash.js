/**
 * Capability bench for DeepSeek API (deepseek-v4-flash by default).
 * Uses key from ai_providers_settings. Does not change Live assistant model.
 */
const OpenAI = require('openai');
const fs = require('fs');
const { Pool } = require('pg');

const MODEL = process.env.BENCH_MODEL || 'deepseek-v4-flash';

function score(text, checks) {
  const t = String(text || '');
  const out = {};
  let pass = 0;
  for (const [k, fn] of Object.entries(checks)) {
    const ok = Boolean(fn(t));
    out[k] = ok;
    if (ok) pass += 1;
  }
  out._pass = pass;
  out._total = Object.keys(checks).length;
  return out;
}

const CASES = [
  {
    id: 'T-dialog',
    title: 'Вести беседу / уточнение',
    messages: [
      {
        role: 'system',
        content:
          'Ты консультант VC HB3. Коротко по-русски. Один уточняющий вопрос. Не вываливай DEAL/ask цифры.',
      },
      { role: 'user', content: 'Расскажите про инвестиции Stage A' },
    ],
    checks: {
      hasQuestion: (t) => /\?/.test(t),
      notDumpDeal: (t) => !(/8\.5|8500|1\.9.*6\.6/i.test(t) && t.length > 400),
      ru: (t) => /[а-яА-Я]/.test(t),
      shortish: (t) => t.length < 600,
    },
  },
  {
    id: 'T-pain',
    title: 'Выявить боль',
    messages: [
      {
        role: 'system',
        content: 'Отрази боль своими словами и задай один вопрос глубже. По-русски.',
      },
      { role: 'user', content: 'Боюсь юридических рисков и что придётся самому продавать' },
    ],
    checks: {
      mirrorsPain: (t) => /риск|продаж|юридич/i.test(t),
      asks: (t) => /\?/.test(t),
      ru: (t) => /[а-яА-Я]/.test(t),
    },
  },
  {
    id: 'T-trajectory',
    title: 'Тип клиента / траектория',
    messages: [
      {
        role: 'system',
        content:
          'Классифицируй тип: public-client | partner | investor-a. Ответь ТОЛЬКО JSON: {"type":"...","why":"...","next":"..."} на русском в why/next.',
      },
      { role: 'user', content: 'Мы IT-команда, хотим писать код по ТЗ партнёра' },
    ],
    checks: {
      typePartner: (t) => /"type"\s*:\s*"partner"/i.test(t),
      jsonish: (t) => /\{[\s\S]*\}/.test(t),
      notInvestor: (t) => !/"type"\s*:\s*"investor/i.test(t),
    },
  },
  {
    id: 'T-sell-facts',
    title: 'Продажа с фактами',
    messages: [
      {
        role: 'system',
        content:
          'Факты: Standard 1000 USDT, Premium 10000 USDT, установка ~15 мин. Продай кратко + вопрос. Не выдумывай ask 8.5M/8500.',
      },
      { role: 'user', content: 'Сколько стоит шаблон DLE?' },
    ],
    checks: {
      has1000: (t) => /1000|1\s*000|1k/i.test(t),
      has10000: (t) => /10000|10\s*000|10k/i.test(t),
      noFakeAsk: (t) => !/8\.5|8500|миллион/i.test(t),
      askOrNext: (t) => /\?|демо|договор|начать/i.test(t),
    },
  },
  {
    id: 'T-no-hallucinate',
    title: 'Отказ выдумывать ask',
    messages: [
      {
        role: 'system',
        content:
          'Аудитория: public-client. ЖЁСТКИЙ ЗАПРЕТ: не называй ask Stage A, $8.5M, $1.9M, $6.6M, «8,5 млн», 25%, 8500. Уточни роль или скажи что условия с командой. Не переводи в рубли.',
      },
      { role: 'user', content: 'Какой у вас ask раунда и сколько процентов отдаёте?' },
    ],
    checks: {
      no85: (t) => !/8\s*[.,]?\s*5\s*[mм]|8500|8\.5/i.test(t),
      no25asDeal: (t) => !(/25\s*%/.test(t) && /акц|дол|equity|доля|отда/i.test(t)),
      honestOrQualify: (t) =>
        /нет в|уточн|роль|инвестор|партн|баз|команд|квалиф/i.test(t) || /\?/.test(t),
    },
  },
  {
    id: 'T-support',
    title: 'Техподдержка из факта',
    messages: [
      {
        role: 'system',
        content:
          'Саппорт. Факт: 1) Установить шаблон ОС (~15 мин). 2) Договор с контрибьютором. 3) Токен-лицензия на кошелёк. Объясни по шагам своими словами + спроси, на каком шаге застряли. Коротко.',
      },
      { role: 'user', content: 'Как начать с DLE?' },
    ],
    checks: {
      stepInstall: (t) => /установ|шаблон|15/i.test(t),
      stepContract: (t) => /договор|контриб/i.test(t),
      question: (t) => /\?/.test(t),
    },
  },
  {
    id: 'T-invest-dialog',
    title: 'Инвестор: диалог, не dump DEAL',
    messages: [
      {
        role: 'system',
        content:
          'Аудитория investor-a. Сначала 1 предложение ценности + 1 уточняющий вопрос. Не вываливай все цифры сразу.\nФакты: $1.9M equity → 25%+IP после; $6.6M на сеть; 8500 токенов; $8.5M ≠ цена 25%.',
      },
      { role: 'user', content: 'Хочу узнать об инвестициях / Stage A' },
    ],
    checks: {
      hasQuestion: (t) => /\?/.test(t),
      notWall: (t) => t.length < 700,
      notAllNumbersAtOnce: (t) => {
        const n = [/\$?1\.9/, /\$?6\.6/, /25\s*%/, /8500|8\s*500/].filter((re) => re.test(t)).length;
        return n <= 2;
      },
    },
  },
];

(async () => {
  const KEY = fs.readFileSync('/app/ssl/keys/full_db_encryption.key', 'utf8').trim();
  const pool = new Pool({
    host: process.env.DB_HOST || 'dapp-postgres',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });
  const r = await pool.query(
    `SELECT decrypt_text(api_key_encrypted,$1) k, decrypt_text(base_url_encrypted,$1) b
     FROM ai_providers_settings WHERE decrypt_text(provider_encrypted,$1)='deepseek' LIMIT 1`,
    [KEY]
  );
  await pool.end();
  if (!r.rows[0]?.k) throw new Error('no deepseek key');

  const client = new OpenAI({
    apiKey: r.rows[0].k,
    baseURL: r.rows[0].b || 'https://api.deepseek.com',
  });

  const t0 = Date.now();
  const smoke = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: 'Ответь одним словом: ок' }],
    max_tokens: 32,
    temperature: 0.3,
    // V4 Flash по умолчанию думает — на малых max_tokens content пустой
    thinking: { type: 'disabled' },
  });
  const smokeMs = Date.now() - t0;
  process.stderr.write(
    `SMOKE ${smokeMs}ms finish=${smoke.choices?.[0]?.finish_reason} text=${JSON.stringify(smoke.choices?.[0]?.message?.content || '').slice(0, 80)}\n`
  );

  const results = [];
  for (const c of CASES) {
    process.stderr.write(`RUN ${c.id}...\n`);
    const started = Date.now();
    try {
      const resp = await client.chat.completions.create({
        model: MODEL,
        messages: c.messages,
        max_tokens: 400,
        temperature: 0.3,
        thinking: { type: 'disabled' },
      });
      const ms = Date.now() - started;
      const msg = resp.choices?.[0]?.message || {};
      const text = msg.content || '';
      const sc = score(text, c.checks);
      results.push({
        id: c.id,
        title: c.title,
        ms,
        pass: sc._pass,
        total: sc._total,
        checks: sc,
        preview: String(text).replace(/\s+/g, ' ').slice(0, 220),
        usage: resp.usage || null,
        finish: resp.choices?.[0]?.finish_reason || null,
        hasReasoning: Boolean(msg.reasoning_content),
      });
    } catch (e) {
      results.push({
        id: c.id,
        title: c.title,
        ms: Date.now() - started,
        pass: 0,
        total: Object.keys(c.checks).length,
        error: e.message,
        preview: '',
      });
    }
  }

  const withMs = results.filter((x) => x.ms);
  const summary = {
    model: MODEL,
    provider: 'deepseek',
    smokeMs,
    at: new Date().toISOString(),
    cases: results,
    passRate:
      results.reduce((a, x) => a + x.pass, 0) /
      Math.max(1, results.reduce((a, x) => a + x.total, 0)),
    latencyMs: {
      min: Math.min(...withMs.map((x) => x.ms)),
      max: Math.max(...withMs.map((x) => x.ms)),
      avg: Math.round(withMs.reduce((a, x) => a + x.ms, 0) / Math.max(1, withMs.length)),
    },
    note: 'Прямой API DeepSeek, thinking=disabled (чат-режим). Live ragService сейчас только Ollama.',
    thinking: 'disabled',
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
