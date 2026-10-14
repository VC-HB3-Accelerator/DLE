'use strict';

/**
 * Vision QA for listing plan B (stdin JSON):
 * { b64, mime, brand, model, csvSpecs, wheelFormula }
 * stdout: { pass, reasons[], has_watermark, has_people, model_mismatch, ... }
 */
const { chatForRole } = require('../services/orchModelRouter');
const { applyLiveProvidersToEnv } = require('../services/orchProviderBridge');

function parseJsonLoose(text) {
  const s = String(text || '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

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

async function main() {
  const input = await readStdin();
  const { b64, mime, brand, model, csvSpecs, wheelFormula } = input;
  if (!b64) {
    process.stdout.write(JSON.stringify({ pass: true, skipped: true, reason: 'no_image' }));
    return;
  }
  await applyLiveProvidersToEnv().catch(() => {});

  const identityLine = [
    brand,
    model,
    csvSpecs ? `характеристики: ${csvSpecs}` : '',
    wheelFormula ? `колёсная формула: ${wheelFormula}` : '',
  ].filter(Boolean).join(' · ');

  const prompt = `Ты QA фото для карточки техники на витрине.
Ожидаемая техника: ${identityLine}

Верни JSON:
{"pass":true|false,"has_watermark":true|false,"has_people":true|false,"has_animals":true|false,"has_artwork":true|false,"has_parts":true|false,"model_mismatch":true|false,"wheel_mismatch":true|false,"has_press_overlay":true|false,"reasons":["..."]}

ЖЁСТКИЙ fail (pass=false) если:
- водяной знак, сток, крупный URL агрегатора;
- люди, пресс-конференция, спорт/знаменитости;
- животные, мульт/CGI, инфографика, выставочный зал без техники;
- запчасти/шильд без целой машины;
- другая модель/марка (например Suzuki Jimny вместо грузовика);
- военная техника;
- новостная плашка ТАСС/РИА с заголовком.

pass=true только для реального фото подходящей техники.`;

  try {
    const { content } = await chatForRole(
      'critic_vision',
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${b64}` } },
          ],
        },
      ],
      { vision: true, json: true, maxTokens: 650 },
    );
    const parsed = parseJsonLoose(content) || { pass: false, has_watermark: true };
    const hardFail =
      parsed.has_watermark === true
      || parsed.has_people === true
      || parsed.has_animals === true
      || parsed.has_artwork === true
      || parsed.has_parts === true
      || parsed.model_mismatch === true
      || parsed.wheel_mismatch === true
      || parsed.has_press_overlay === true;
    let pass = Boolean(parsed.pass) && !hardFail;
    if (hardFail) pass = false;
    process.stdout.write(JSON.stringify({
      pass,
      reasons: parsed.reasons || [],
      has_watermark: Boolean(parsed.has_watermark),
      has_people: Boolean(parsed.has_people),
      has_animals: Boolean(parsed.has_animals),
      has_artwork: Boolean(parsed.has_artwork),
      has_parts: Boolean(parsed.has_parts),
      model_mismatch: Boolean(parsed.model_mismatch),
      wheel_mismatch: Boolean(parsed.wheel_mismatch),
      has_press_overlay: Boolean(parsed.has_press_overlay),
    }));
  } catch (e) {
    process.stdout.write(JSON.stringify({
      pass: true,
      soft: true,
      skipped: true,
      reasons: [`vision_error:${e.message}`],
    }));
  }
}

main().catch((e) => {
  process.stdout.write(JSON.stringify({ pass: true, soft: true, error: String(e.message) }));
});
