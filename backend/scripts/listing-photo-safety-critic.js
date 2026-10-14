'use strict';

/**
 * Safety vision (LLM). stdin JSON { b64, mime } → stdout { pass, ... }
 * Копируется в /app/scripts/listing-photo-safety-critic.js при pipeline.
 */
const { chatForRole } = require('../../services/orchModelRouter');
const { applyLiveProvidersToEnv } = require('../../services/orchProviderBridge');

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

function safetyHardFail(parsed) {
  return (
    parsed.has_military === true
    || parsed.has_people === true
    || parsed.has_animals === true
    || parsed.has_artwork === true
    || parsed.has_parts === true
    || parsed.has_buildings === true
    || parsed.has_press_overlay === true
  );
}

async function main() {
  const input = await readStdin();
  const { b64, mime } = input;
  if (!b64) {
    process.stdout.write(JSON.stringify({ pass: true, skipped: true }));
    return;
  }
  await applyLiveProvidersToEnv().catch(() => {});

  const prompt = `Ты фильтр фото для витрины гражданской техники.
JSON: {"pass":true|false,"has_military":bool,"has_people":bool,"has_animals":bool,"has_artwork":bool,"has_parts":bool,"has_buildings":bool,"has_press_overlay":bool,"reasons":[]}

fail: военка, люди/пресс-конференция/спорт (Neymar), животные, мульт/CGI/инфографика, запчасти/шильд без машины, здание/переговорная, плашка ТАСС/РИА с заголовком, выставка без техники.
pass: реальное фото гражданской техники.`;

  try {
    const { content } = await chatForRole(
      'critic_vision',
      [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${b64}` } },
        ],
      }],
      { vision: true, json: true, maxTokens: 500 },
    );
    const parsed = parseJsonLoose(content) || { pass: false, has_military: true };
    const hardFail = safetyHardFail(parsed);
    let pass = Boolean(parsed.pass) && !hardFail;
    if (hardFail) pass = false;
    process.stdout.write(JSON.stringify({
      pass,
      has_military: Boolean(parsed.has_military),
      has_people: Boolean(parsed.has_people),
      has_animals: Boolean(parsed.has_animals),
      has_artwork: Boolean(parsed.has_artwork),
      has_parts: Boolean(parsed.has_parts),
      has_buildings: Boolean(parsed.has_buildings),
      has_press_overlay: Boolean(parsed.has_press_overlay),
      reasons: parsed.reasons || [],
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
