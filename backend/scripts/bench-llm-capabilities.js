/**
 * Capability bench for current Ollama LLM (no pull, no settings change).
 * Writes JSON summary to stdout.
 */
const http = require('http');

const MODEL = process.env.BENCH_MODEL || 'qwen2.5:7b';
const HOST = process.env.OLLAMA_HOST || 'dapp-ollama';
const PORT = Number(process.env.OLLAMA_PORT || 11434);

function chat(messages, opts = {}) {
  const body = JSON.stringify({
    model: MODEL,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.3,
      num_predict: opts.maxTokens ?? 220,
    },
    messages,
  });
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/chat',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 180000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const ms = Date.now() - t0;
          try {
            const j = JSON.parse(data);
            resolve({
              ms,
              text: j.message?.content || j.response || '',
              error: j.error || null,
              eval_count: j.eval_count,
              eval_duration: j.eval_duration,
            });
          } catch (e) {
            reject(new Error(`parse ${e.message}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(body);
    req.end();
  });
}

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
          'Ты консультант VC HB3 в чате. Не киоск документов. Кратко на русском. Задай ровно один уточняющий вопрос.',
      },
      { role: 'user', content: 'Хочу узнать об инвестициях / Stage A' },
    ],
    checks: {
      hasQuestion: (t) => /\?/.test(t),
      notDumpDeal: (t) => !/8\.5\s*M|8500|25%/.test(t) || (t.match(/\?/g) || []).length >= 1,
      ru: (t) => /[А-Яа-яЁё]{8,}/.test(t),
      shortish: (t) => t.length < 900,
    },
  },
  {
    id: 'T-pain',
    title: 'Выявить боль',
    messages: [
      {
        role: 'system',
        content:
          'Ты консультант. Цель — выявить боль клиента (деньги, риск, сроки, IT). Один короткий абзац + один вопрос. Русский.',
      },
      {
        role: 'user',
        content: 'Мы IT-компания, думаем открыть направление с вами, но боимся юридических рисков и что придётся всё продавать самим.',
      },
    ],
    checks: {
      mirrorsPain: (t) => /риск|юр|продаж|боит/i.test(t),
      asks: (t) => /\?/.test(t),
      ru: (t) => /[А-Яа-яЁё]{10,}/.test(t),
    },
  },
  {
    id: 'T-trajectory',
    title: 'Тип клиента / траектория',
    messages: [
      {
        role: 'system',
        content:
          'Классифицируй тип: public-client | partner | investor-a. Ответь JSON: {"type":"...","why":"...","next":"..."}. Только JSON.',
      },
      { role: 'user', content: 'Интересует партнёрство / контрибьютор, хотим писать код под ваше ТЗ' },
    ],
    checks: {
      typePartner: (t) => /partner/i.test(t),
      jsonish: (t) => /\{/.test(t) && /type/i.test(t),
      notInvestor: (t) => !/investor-a/i.test(t) || /partner/i.test(t),
    },
  },
  {
    id: 'T-sell-facts',
    title: 'Продажа с фактами (не выдумывать)',
    messages: [
      {
        role: 'system',
        content:
          'Консультант. Используй ТОЛЬКО факты ниже. Не добавляй сумм, которых нет. 2–4 предложения + вопрос. Русский.\nФакты: Standard 1000 USDT, Premium 10000 USDT. Установка шаблона ОС ~15 мин.',
      },
      { role: 'user', content: 'Сколько стоит и как быстро начать?' },
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
          'Аудитория: public-client. ЖЁСТКИЙ ЗАПРЕТ: не называй ask Stage A, $8.5M, $1.9M, $6.6M, «8,5 млн», 25%, 8500 токенов — этих цифр нет в контексте. На вопрос про ask/%/долю: не угадывай; уточни роль (клиент/партнёр/инвестор) или скажи, что условия сделки обсуждаются с командой после квалификации. Не переводи в рубли от себя.',
      },
      { role: 'user', content: 'Какой у вас ask раунда и сколько процентов отдаёте?' },
    ],
    checks: {
      no85: (t) => !/8\s*[.,]?\s*5\s*[mм]|8500|8\.5/i.test(t),
      no25asDeal: (t) => !(/25\s*%/.test(t) && /акц|дол|equity|доля|отда/i.test(t)),
      honestOrQualify: (t) => /нет в|уточн|роль|инвестор|партн|баз|команд|квалиф/i.test(t) || /\?/.test(t),
    },
  },
  {
    id: 'T-support',
    title: 'Техподдержка из факта',
    messages: [
      {
        role: 'system',
        content:
          'Саппорт. Факт: 1) Установить шаблон ОС (~15 мин). 2) Договор с контрибьютором. 3) Токен-лицензия на кошелёк. Объясни по шагам своими словами + спроси, на каком шаге застряли.',
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
          'Аудитория investor-a. Можно опираться на факты, но сначала 1 предложение ценности + 1 уточняющий вопрос. Не вываливай все цифры сразу.\nФакты: $1.9M equity → 25%+IP после; $6.6M на сеть; 8500 токенов; $8.5M ≠ цена 25%.',
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
  const results = [];
  // warm-up
  try {
    await chat([{ role: 'user', content: 'Скажи одно слово: ок' }], { maxTokens: 8 });
  } catch (_) {}

  for (const c of CASES) {
    process.stderr.write(`RUN ${c.id}...\n`);
    try {
      const r = await chat(c.messages);
      const sc = score(r.text, c.checks);
      results.push({
        id: c.id,
        title: c.title,
        ms: r.ms,
        eval_count: r.eval_count,
        pass: sc._pass,
        total: sc._total,
        checks: sc,
        preview: String(r.text).replace(/\s+/g, ' ').slice(0, 220),
        error: r.error,
      });
    } catch (e) {
      results.push({
        id: c.id,
        title: c.title,
        ms: null,
        pass: 0,
        total: Object.keys(c.checks).length,
        error: e.message,
        preview: '',
      });
    }
  }

  const summary = {
    model: MODEL,
    host: HOST,
    at: new Date().toISOString(),
    cases: results,
    passRate: results.reduce((a, x) => a + x.pass, 0) / Math.max(1, results.reduce((a, x) => a + x.total, 0)),
    latencyMs: {
      min: Math.min(...results.map((x) => x.ms).filter(Boolean)),
      max: Math.max(...results.map((x) => x.ms).filter(Boolean)),
      avg: Math.round(
        results.filter((x) => x.ms).reduce((a, x) => a + x.ms, 0) / Math.max(1, results.filter((x) => x.ms).length)
      ),
    },
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
