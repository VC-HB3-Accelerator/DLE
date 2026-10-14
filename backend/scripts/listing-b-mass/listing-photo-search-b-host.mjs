/**
 * Plan B mass: запросы из CSV (контекст + ракурсы), objfix → attach через pipeline.
 * Результат: /tmp/objfix-b/{pageId}/
 *
 * CLEAR_PHOTOS=0  — не трогать listing_media
 * QUERY_GEN=llm|rules  — llm: Qwen (QUERY_GEN_MODEL=qwen3.8-max), rules: CSV+SERP
 * BLOG_SKIP / BLOG_TAKE — срез ленты (если нет TEST_IDS / PAGE_IDS)
 * TEST_IDS / PAGE_IDS — id из БД, без топ-N ленты
 * IMAGE_ENGINES=yandex — только Yandex Images (DDG отключён)
 * SKIP_SERP=1 — не ходить в Bing SERP для enrich
 * SKIP_MILITARY=0 — не отсекать URL с военной/war-тематикой (по умолчанию фильтр включён)
 * SKIP_HUMAN_BODY=0 — не отсекать URL с телом/обнажёнкой/gore (по умолчанию фильтр включён)
 * LISTING_MIN_YEAR=2020 — reject URL с годом &lt; порога; LISTING_YEAR_HINT=2024 2025 — в searchBase/запросах
 * SKIP_LISTING_YEAR_URL=1 — не фильтровать старые годы в URL
 * B_VISION_POST=0 — без vision QA после download (по умолчанию 1: WM, люди, модель/оси)
 * YANDEX_ISIZE / YANDEX_ITYPE / YANDEX_IORIENT — фильтры URL Yandex Images
 * YANDEX_LR_LIST — регионы Yandex Images (коды lr через запятую); YANDEX_LR_MODE=rotate|all
 * LISTING_QUERY_MINUS — минус-слова в text (0 = выкл); по умолчанию -avito -drom -авария -дтп -crash …
  * BING_CC_LIST — cc= для Bing Images (если bing в IMAGE_ENGINES)
 * INCREMENTAL_ATTACH=1 — manifest + attach в БД по мере picked (≥ATTACH_MIN), не только в конце карточки
 * ATTACH_MIN=1 — см. attach-listing-objfix-b.js (минимум picked для первой заливки)
 * SEARCH_TAKE_PER_PLAN — сколько URL сохранить с одного plan (default 1)
 * SEARCH_TRY_PER_PLAN — сколько URL перебрать из hits (default max(6, take*4)); 0|all|unlimited = весь список hits
 * MAX_SAVED — objfix на карточку (= ATTACH_TARGET, 8)
 * OBJFIX_BIND_MOUNT=1 — attach без cp/rm
 * SEARCH_LOCK — путь lock-файла (один процесс поиска)
 *
 * Пайплайн: backend/scripts/run-listing-b-pipeline.sh
 */
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const SCRIPT_DIR = process.env.LISTING_B_SCRIPT_DIR || path.dirname(fileURLToPath(import.meta.url));
const LISTING_B_MASS_DIR_EARLY = path.join(SCRIPT_DIR, 'listing-b-mass');
import crypto from 'crypto';
import { createRequire } from 'module';
import { execSync, spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const SPAWN_JSON_PATH = fs.existsSync(path.join(LISTING_B_MASS_DIR_EARLY, 'listing-spawn-json.js'))
  ? path.join(LISTING_B_MASS_DIR_EARLY, 'listing-spawn-json.js')
  : path.join(SCRIPT_DIR, 'listing-spawn-json.js');
const { parseSpawnStdoutJson } = require(SPAWN_JSON_PATH);

import pkg from '/tmp/node_modules/playwright/index.js';
const sharp = require(process.env.SHARP_PKG || '/home/alex/b2-b4.com/backend/node_modules/sharp');
const { rejectWatermarkUrl } = require(path.join(SCRIPT_DIR, '../services/listingPool/watermarkFilter.js'));
const {
  parseWheelFormula,
  urlModelConflict,
  urlWheelConflict,
  urlYearRejected,
  listingYearSearchSuffix,
} = require(path.join(SCRIPT_DIR, '../services/listingPool/listingPhotoUrlPolicy.js'));
const { rejectListingSourceUrl: rejectListingSourceUrlBase } = require(path.join(SCRIPT_DIR, '../services/listingPool/listingPhotoSourcePolicy.js'));
const { normalizeListingBuffer } = require(path.join(SCRIPT_DIR, 'listing-b-mass/normalize-listing-feed-image.js'));
const { extraListingUrlBlocked } = require(path.join(SCRIPT_DIR, 'listing-b-mass/listing-extra-url-block.js'));
const { analyzeBuffer: pixelAnalyzeBuffer } = require(path.join(SCRIPT_DIR, 'listing-b-mass/listing-photo-pixel-heuristic.js'));
const STOCK_MARKETPLACE_RE = /made-in-china|alicdn\.com|alibaba\.com/i;
function rejectListingSourceUrl(url) {
  const u = String(url || '');
  if (STOCK_MARKETPLACE_RE.test(u)) return { ok: false, reason: 'stock_marketplace_host' };
  const extra = extraListingUrlBlocked(u);
  if (extra) return { ok: false, reason: extra };
  return rejectListingSourceUrlBase(u);
}

function pixelGateEnabled() {
  return process.env.LISTING_PIXEL_GATE !== '0';
}

async function runPixelHeuristicGate(buf) {
  if (!pixelGateEnabled()) return { pass: true, skipped: true };
  try {
    return await pixelAnalyzeBuffer(buf);
  } catch {
    return { pass: true, soft: true, skipped: true };
  }
}

const { chromium } = pkg;
const CHROME = '/home/alex/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const ROOT = '/tmp/objfix-b';
const CSV = '/home/alex/b2-b4.com/data/sku-catalog-2026.csv';
const PLAN_VERSION = 'b-cascade-v4-official-tails';
/** Контекст текущей карточки для uniqUrls / isBlockedMediaUrl (один процесс = одна карточка). */
let currentListingCtx = null;
const PICK_MIN_HAMMING = Number(process.env.PICK_MIN_HAMMING || 9);
const INGEST_MIN_HAMMING = Number(process.env.INGEST_MIN_HAMMING || 8);
const ATTACH_MILESTONES = (process.env.ATTACH_MILESTONES || '1,4,8')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isInteger(n) && n > 0);
const SERP_JUNK = /википед|перевод|переводчик|яндекс|google|достопримечатель|турист|форум|отзыв|купить|цена/i;
const QUERY_GEN_MODEL = process.env.QUERY_GEN_MODEL || 'qwen3.8-max';
const STOCK = /shutterstock|depositphotos|gettyimages|istockphoto|adobe\.stock|dreamstime|alamy|123rf|freepik|watermark|favicon|\.ico(\?|$)|pinimg\.com\/736x/i;
const GOTO_MS = 45000;
const FETCH_MS = 28000;
const BODY_MS = 22000;
const CARD_PHOTO_TARGET = Math.min(8, Math.max(1, Number(process.env.ATTACH_TARGET || 8)));
const MAX_SAVED = Math.max(CARD_PHOTO_TARGET, Number(process.env.MAX_SAVED || CARD_PHOTO_TARGET));
const LOCK_PATH = process.env.SEARCH_LOCK || '/tmp/listing-photo-search-b.lock';

function parsePageIds(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) return JSON.parse(s);
  return s
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function acquireSearchLock() {
  if (fs.existsSync(LOCK_PATH)) {
    const pid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        throw new Error(`listing-photo-search-b already running (pid ${pid}, lock ${LOCK_PATH})`);
      } catch (e) {
        if (e.code !== 'ESRCH' && !String(e.message || e).includes('already running')) throw e;
      }
    }
  }
  fs.writeFileSync(LOCK_PATH, String(process.pid));
}

function releaseSearchLock() {
  try {
    if (fs.existsSync(LOCK_PATH) && fs.readFileSync(LOCK_PATH, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch { /* ignore */ }
}

const LISTING_B_MASS_DIR = path.join(SCRIPT_DIR, 'listing-b-mass');

function ensureDockerListingBScripts() {
  const copies = [
    [path.join(LISTING_B_MASS_DIR, 'attach-listing-objfix-b.js'), 'dapp-backend:/app/scripts/attach-listing-objfix-b.js'],
    [path.join(LISTING_B_MASS_DIR, 'normalize-listing-feed-image.js'), 'dapp-backend:/app/scripts/normalize-listing-feed-image.js'],
    [path.join(LISTING_B_MASS_DIR, 'listing-extra-url-block.js'), 'dapp-backend:/app/scripts/listing-extra-url-block.js'],
    [SPAWN_JSON_PATH, 'dapp-backend:/app/scripts/listing-spawn-json.js'],
    [path.join(LISTING_B_MASS_DIR, 'listing-photo-pixel-heuristic.js'), 'dapp-backend:/app/scripts/listing-photo-pixel-heuristic.js'],
  ];
  for (const [src, dest] of copies) {
    if (!fs.existsSync(src)) continue;
    execSync(`docker.exe cp "${src}" ${dest}`, { stdio: 'pipe' });
  }
}

function syncAndAttachCard(pageId) {
  ensureDockerListingBScripts();
  const bindMount = process.env.OBJFIX_BIND_MOUNT !== '0';
  if (!bindMount) {
    const dest = path.join(ROOT, String(pageId));
    execSync('docker.exe exec dapp-backend mkdir -p /tmp/objfix-b', { stdio: 'pipe' });
    execSync(`docker.exe cp "${dest}" dapp-backend:/tmp/objfix-b/`, { stdio: 'pipe' });
  }
  const attachMin = process.env.ATTACH_MIN || '1';
  const attachTarget = process.env.ATTACH_TARGET || '8';
  const resetMapEnv = process.env.ATTACH_RESET_FILE_MAP === '1' ? ' -e ATTACH_RESET_FILE_MAP=1' : '';
  const qGate = process.env.ATTACH_QUALITY_GATE === '1' ? '1' : '0';
  const merge = process.env.ATTACH_MERGE_EXISTING === '0' ? '0' : '1';
  const ingestAll = process.env.ATTACH_INGEST_ALL_FILES === '1' ? '1' : '0';
  const blockPng = process.env.LISTING_BLOCK_PNG_URL === '0' ? '0' : '1';
  const pixelGate = process.env.LISTING_PIXEL_GATE === '0' ? '0' : '1';
  const out = execSync(
    `docker.exe exec -w /app -e OBJFIX_ROOT=/tmp/objfix-b -e PAGE_IDS=${pageId} -e ATTACH_MIN=${attachMin} -e ATTACH_TARGET=${attachTarget}${resetMapEnv} -e ATTACH_QUALITY_GATE=${qGate} -e ATTACH_MERGE_EXISTING=${merge} -e ATTACH_INGEST_ALL_FILES=${ingestAll} -e LISTING_BLOCK_PNG_URL=${blockPng} -e LISTING_PIXEL_GATE=${pixelGate} dapp-backend node scripts/attach-listing-objfix-b.js`,
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  for (const line of out.trim().split('\n').filter(Boolean)) {
    try {
      const row = JSON.parse(line);
      if (row.id === pageId && (row.ok || row.skip || row.have !== undefined)) log({ phase: 'attach', ...row });
    } catch { /* ignore */ }
  }
}

function log(row) {
  console.log(JSON.stringify({ plan: PLAN_VERSION, ...row }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') {
      row.push(field);
      field = '';
      if (row.some((c) => c)) rows.push(row);
      row = [];
    } else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((c) => c)) rows.push(row);
  }
  const header = rows.shift();
  return rows.map((cells) => Object.fromEntries(header.map((h, idx) => [h, cells[idx] || ''])));
}

function enBrand(brand) {
  const map = { КАМАЗ: 'KAMAZ', МАЗ: 'MAZ', Урал: 'Ural', ДАФ: 'DAF', 'Renault Trucks': 'Renault Trucks' };
  return map[brand] || brand;
}

function stripShassiForSearch(text) {
  return String(text || '')
    .replace(/\s+на\s+шасси\s+/gi, ' ')
    .replace(/—\s*шасси\s*;?\s*/gi, '— ')
    .replace(/шасси/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function bodyEn(body) {
  const b = body.toLowerCase();
  if (b.includes('тягач') || b.includes('седель')) return 'tractor truck';
  if (b.includes('борт')) return 'flatbed truck';
  if (b.includes('кросс') || b.includes('suv') || b.includes('минивэн')) return 'SUV';
  return 'vehicle';
}

function bodyHint(description, segment) {
  const parts = (description || '').split(';').map((s) => s.trim()).filter(Boolean);
  const useful = parts.find((p) => !/глобальный каталог|официальн/i.test(p)) || parts[1] || parts[0] || '';
  if (/тягач|борт|кросс|седель|фургон|минивэн|комплектация|модель/i.test(useful)) return stripShassiForSearch(useful);
  if (segment === 'gruzoviki') return 'магистральный тягач грузовик';
  if (segment === 'premium') return 'автомобиль';
  if (segment === 'spectehnika') return 'спецтехника';
  if (segment === 'oborudovanie') {
    const d0 = (useful || parts[0] || '').split(/[;,]/)[0].trim();
    return stripShassiForSearch(d0 || 'промышленное оборудование');
  }
  return stripShassiForSearch(useful || 'техника');
}

function specsFromDescription(description) {
  return (description || '')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !/₽|витрин|https?:|\/\/|цен[аы]|от\s*~?\s*\d|глобальный каталог/i.test(s))
    .join(' ');
}

const SERP_STOP = new Set([
  'описание', 'характеристики', 'характеристика', 'купить', 'цена', 'цен', 'продажа', 'официальный',
  'официальная', 'сайт', 'год', 'от', 'для', 'the', 'and', 'with', 'auto', 'car', 'new', 'www',
  'com', 'ru', 'http', 'https', 'обзор', 'видео', 'форум', 'отзывы', 'магазин', 'заказать',
  'elektrisch', 'hybride', 'benzine', 'bekijk', 'onze', 'modellen', 'ontdek', 'personenauto', 'zoek', 'naar',
]);
const SERP_EN_OK = /^(truck|trucks|chassis|tractor|semi|trailer|cab|official|press|renault|kamaz|maz|daf|zeekr|exeed|ural|cargo|vehicle|lorry|hdv)$/i;

function serpWordOk(word) {
  const wl = word.toLowerCase();
  if (SERP_STOP.has(wl)) return false;
  if (/[\u0400-\u04ff]/.test(word)) return true;
  return SERP_EN_OK.test(wl);
}

function shortCsvHint(row) {
  const hint = bodyHint(row.description, row.segment);
  return hint.split(/[;,]/)[0].trim().slice(0, 72);
}

async function serpEnrichTerms(page, query, brand, model) {
  await page.goto(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ru&cc=RU`,
    { waitUntil: 'domcontentloaded', timeout: GOTO_MS },
  );
  await sleepPage(page, 900);
  let titles = [];
  try {
    titles = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('#b_results h2 a, li.b_algo h2 a').forEach((a) => {
        const t = a.textContent?.trim();
        if (t && t.length > 6) out.push(t);
      });
      return out.slice(0, 12);
    });
  } catch {
    titles = [];
  }
  const modelTok = modelTokens(brand, model);
  const extra = [];
  for (const title of titles) {
    const words = title.match(/[\u0400-\u04ff]{4,}|[a-z0-9]{4,}/gi) || [];
    for (const w of words) {
      const wl = w.toLowerCase();
      if (!serpWordOk(w)) continue;
      if (modelTok.some((t) => wl.includes(t) || t.includes(wl))) continue;
      if (/^20\d{2}$/.test(wl)) continue;
      if (SERP_JUNK.test(wl)) continue;
      extra.push(w);
    }
  }
  return [...new Set(extra.map((w) => w.toLowerCase()))].slice(0, 4);
}

function composeSearchBase(row, baseHints, serpTerms) {
  const product = stripShassiForSearch(`${row.brand} ${row.model}`).replace(/\s+/g, ' ').trim();
  const hint = stripShassiForSearch(shortCsvHint(row)).slice(0, 48);
  const serp = process.env.SKIP_SERP === '1' ? [] : (serpTerms || []);
  const chunks = [product, hint, ...(baseHints || []).slice(0, 2), ...serp.slice(0, 2)];
  const seen = new Set();
  const words = [];
  for (const chunk of chunks.join(' ').split(/\s+/)) {
    const w = chunk.trim();
    if (!w) continue;
    const key = w.toLowerCase();
    if (seen.has(key)) continue;
    if (SERP_JUNK.test(w)) continue;
    seen.add(key);
    words.push(w);
    if (words.length >= 10) break;
  }
  for (const y of listingYearSearchSuffix().split(/\s+/)) {
    const key = y.toLowerCase();
    if (!y || seen.has(key)) continue;
    seen.add(key);
    words.push(y);
    if (words.length >= 10) break;
  }
  let base = words.join(' ').trim();
  if (base.length > 96) base = base.slice(0, 96).replace(/\s+\S*$/, '');
  return base;
}

function dedupePhotoTails(list) {
  const seen = new Set();
  const out = [];
  for (const t of list || []) {
    const tail = String(t.tail ?? '').trim();
    const bucket = String(t.bucket || 'any');
    const key = `${bucket}:${tail}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ bucket, tail });
    if (out.length >= 8) break;
  }
  return out;
}

function defaultPhotoTails(row, hint) {
  const desc0 = String(hint || '').split(/[;,]/)[0].toLowerCase();
  if (row.segment === 'premium') {
    return dedupePhotoTails([
      { bucket: 'front34', tail: 'ракурс три четверти' },
      { bucket: 'rear', tail: 'вид сзади' },
      { bucket: 'side', tail: 'профиль' },
      { bucket: 'front', tail: 'вид спереди' },
      { bucket: 'cabin', tail: 'салон водитель' },
      { bucket: 'cabin', tail: 'интерьер задний ряд' },
      { bucket: 'detail', tail: 'панель экран' },
      { bucket: 'detail', tail: 'деталь' },
    ]);
  }
  if (row.segment === 'spectehnika') {
    return dedupePhotoTails([
      { bucket: 'front34', tail: 'три четверти' },
      { bucket: 'side', tail: 'вид сбоку' },
      { bucket: 'rear', tail: 'вид сзади' },
      { bucket: 'work', tail: 'ковш стрела рабочий орган' },
      { bucket: 'cabin', tail: 'кабина' },
      { bucket: 'detail', tail: 'гусеницы ходовая' },
      { bucket: 'work', tail: 'рабочее положение' },
      { bucket: 'any', tail: 'пресс-фото' },
    ]);
  }
  if (row.segment === 'oborudovanie') {
    if (/станок|лазер|гиб|токар|фрез/i.test(desc0)) {
      return dedupePhotoTails([
        { bucket: 'front34', tail: 'станок три четверти' },
        { bucket: 'work', tail: 'зона обработки' },
        { bucket: 'cabin', tail: 'пульт управления' },
        { bucket: 'side', tail: 'вид сбоку' },
        { bucket: 'detail', tail: 'шильда модель' },
        { bucket: 'front', tail: 'фронт панель' },
        { bucket: 'work', tail: 'рабочий узел крупно' },
        { bucket: 'any', tail: 'официальное фото' },
      ]);
    }
    return dedupePhotoTails([
      { bucket: 'front34', tail: 'три четверти' },
      { bucket: 'side', tail: 'профиль' },
      { bucket: 'rear', tail: 'вид сзади' },
      { bucket: 'work', tail: 'рабочая зона узел' },
      { bucket: 'cabin', tail: 'кабина пульт' },
      { bucket: 'detail', tail: 'деталь шильда' },
      { bucket: 'any', tail: 'общий план' },
      { bucket: 'any', tail: 'пресс-фото' },
    ]);
  }
  return dedupePhotoTails([
    { bucket: 'side', tail: 'официальное фото вид сбоку' },
    { bucket: 'front', tail: 'официальное фото вид спереди' },
    { bucket: 'rear', tail: 'официальное фото вид сзади' },
    { bucket: 'front34', tail: 'официальное фото ракурс три четверти' },
    { bucket: 'cabin', tail: 'салон кабина' },
  ]);
}

/** Минус-слова Yandex Images (LISTING_QUERY_MINUS=0 отключает). */
function listingQueryMinusSuffix() {
  if (process.env.LISTING_QUERY_MINUS === '0') return '';
  const raw = process.env.LISTING_QUERY_MINUS
    ?? '-avito -drom -объявление -watermark -wallpaper -обои -люди -водитель -portrait -team -здание -facade -vintage -infographic -png -tass -ria -новост -пресс -конференц -футбол -neymar -выставк -самолет -roblox -инфографик -авария -дтп -accident -crash -crashed -wreck -collision -damaged -totaled -salvage -разбит -битый -поврежден -столкновение -перевернут -spy -prototype -camouflage -camo -motor1 -шпион -прототип -камуфляж -mule -testmule';
  return String(raw).trim();
}

/** Каскад шаг 3: searchBase + offPhrase + tail (≥10). */
function buildPhotoPlans(searchBase, row, hint, tails) {
  const yearHint = listingYearSearchSuffix();
  const offPhrase = row.segment === 'premium'
    ? `официальные фото модели ${yearHint} завод`
    : `заводское пресс-фото ${yearHint} официальные`;
  const minus = listingQueryMinusSuffix();
  const modifiers = dedupePhotoTails(tails?.length ? tails : defaultPhotoTails(row, hint));
  return modifiers.map(({ bucket, tail }) => ({
    phase: 'photo',
    bucket,
    q: `${searchBase} ${offPhrase}${tail ? ` ${tail}` : ''}${minus ? ` ${minus}` : ''}`.replace(/\s+/g, ' ').trim(),
  }));
}

function modelTokens(brand, model) {
  const raw = `${brand} ${model}`.toLowerCase();
  return [...new Set((raw.match(/[a-z0-9]{3,}|[\u0400-\u04ff]{3,}/gi) || []))];
}

const DEALER_URL = /avito|auto\.ru|avatars\.avto|get-autoru-vos|autoru-vos|media\.au\.ru|(?:^|[/.])au\.ru\/|drom\.|truck\.ru|gruzovik\d|linemedia\.com|avto-master\.com|truck-holding\.ru|avtofurgon\.ru|alfaleasing|car-search-public|car-search[\-_]?public|storage\.yandexcloud\.net\/car-search|stpulscen|pulscen|autospot|europlan|gazpromleasing|sberleasing|vtbleasing|carprice|freshauto|carmart|\.dealer|dealer-|promo|banner|8-800|tel:|объявлен|classified|thompsoncommercials|autotrader|leasing[\-_]?catalog|_next\/image|used[\-_]?truck|б[\s\-]?у[\s\-]?груз/i;
/** Военная техника и war-контент — не для карточек гражданского каталога. SKIP_MILITARY=0 отключает. */
const MILITARY_HOST = /armyrecognition|military[\-_]?today|defence[\-_]?blog|warhistory|globalsecurity|janes\.com|topwar\.ru|lostarmour|liveuamap|bmpd\.|ukrainewar|war[\-_]?zone[\-_]?news|conflict[\-_]?arm|under[\-_]?the[\-_]?rap/i;
const MILITARY_PATH = /военн|армейск|бронетех|бронемаш|бмп[\-_]|бтр[\-_]|бмд[\-_]|артиллер|огнемет|миномет|смерч|град[\-_]|ракет(?:н|а|ы)|танк(?:ов|и|а|е)?[\-_\/]|battle[\-_]?tank|main[\-_]?battle|(?<![a-z0-9])t[\-_ ]?(?:72|80|90|14|64|55|34)(?![0-9a-z])|bmp[\-_ ]?[1-3]|btr[\-_ ]?(?:60|70|80|82)|(?:^|[\/_\-\.])mbt(?:[\/_\-\.]|$)|military[\-_]?vehicle|armored[\-_]?vehicle|warfare|warzone|frontline|anti[\-_]?tank|humvee|himars|iskander|bayraktar|shahed|geran[\-_]?2|leopard[\-_]?2|abrams|bradley|stryker|mr[\-_]?ap|typhoon[\-_]?k|63968|53949|tigr[\-_]m|ural[\-_]m(?:[\-_\/.]|$)|4320[\-_]31|камуфл|camouflage[\-_]?net|z[\-_]?symbol|parade[\-_]?red|9[\-_]?may[\-_]?parade|(\/|\-|_)tanks?(\/|\-|_|\.|\?|$)/i;
/** Тело / обнажёнка / gore по URL (не cab-body / body-panel). SKIP_HUMAN_BODY=0 отключает. */
const HUMAN_BODY_HOST = /pornhub|xhamster|xvideos|redtube|youporn|xnxx|onlyfans|playboy|penthouse|metart|sex\.com|erotic/i;
const HUMAN_BODY_PATH = /(?:^|[\/_\-\.])(?:nude|nudes|naked|nsfw|gore|corpse|mutilat|behead|dismember|autopsy|morgue|porn(?:o|hub)?|xxx|hentai|stripper|topless|bottomless|playboy|onlyfans|human[\-_]?body|dead[\-_]?body|female[\-_]?body|male[\-_]?body|обнаж|гол(?:ый|ая|ое|ые|ыш)|труп|расчлен|эрот|порно|интим(?:ное|ные)?[\-_]?фото)(?:[\/_\-\.]|$)|(?:^|[\/_\-\.])(?:blood|bleeding|casualt(?:y|ies))(?:[\/_\-\.]|$)/i;
const ENGINE_FAIL_STREAK_MAX = Number(process.env.ENGINE_FAIL_STREAK_MAX || 8);

function mediaUrlHaystack(url) {
  try {
    return decodeURIComponent(String(url || '')).toLowerCase();
  } catch {
    return String(url || '').toLowerCase();
  }
}

function isMilitaryBlocked(url) {
  if (process.env.SKIP_MILITARY === '0') return false;
  const u = mediaUrlHaystack(url);
  if (!u) return false;
  if (/septictank|fuel[\-_]?tank|water[\-_]?tank|tank[\-_]?container|think[\-_]?tank|tanker/i.test(u)) return false;
  if (MILITARY_HOST.test(u)) return true;
  return MILITARY_PATH.test(u);
}

function isHumanBodyBlocked(url) {
  if (process.env.SKIP_HUMAN_BODY === '0') return false;
  const u = mediaUrlHaystack(url);
  if (!u) return false;
  if (/body[\-_]?(?:panel|work|shop|style|builder|type|kit|cab|truck|van|car|vehicle|compartment|mount|seal|guard|armor|repair)|cab[\-_]?body|кузов|кабина/i.test(u)) {
    return false;
  }
  if (HUMAN_BODY_HOST.test(u)) return true;
  return HUMAN_BODY_PATH.test(u);
}

function isWatermarkBlocked(url) {
  if (process.env.SKIP_WATERMARK_FILTER === '1') return false;
  const check = rejectWatermarkUrl(url);
  return !check.ok;
}

/** Прототип / spy shot / камуфляж на испытаниях. SKIP_SPY_PROTOTYPE=1 отключает. */
const SPY_PROTOTYPE_URL =
  /motor1\.|autospies|carscoops|spy[\-_]?shot|test[\-_]?mule|prototype|camo[\-_]?wrap|camouflage[\-_]?(?:wrap|car|vehicle)|шпион|прототип|камуфляж|pre[\-_]?production|mule[\-_]?car|disguised[\-_]?car/i;

function isSpyPrototypeBlocked(url) {
  if (process.env.SKIP_SPY_PROTOTYPE === '1') return false;
  const u = mediaUrlHaystack(url);
  if (!u) return false;
  return SPY_PROTOTYPE_URL.test(u);
}

const JUNK_PHOTO_URL_RE =
  /neymar|ronaldo|messi|football|soccer|fifa|uefa|celebrit|болель|футбол|fan[\-_]?zone|old[\-_]?photo|vintage|archival|sepia|black[\-_]and[\-_]white|black[\-_]white|facade|skyline|architecture|университет|кремл|ministry[\-_]?building|historic[\-_]?building|museum[\-_]?building|apartment[\-_]?complex|infographic|comfyui|wallpaper|обои|poster[\-_]?print|celebrity|red[\-_]?carpet|premier[\-_]?league|roblox|minecraft|airplane|самол[её]т|passenger|пассажир|headphone|наушник|exhibition|выставк|tass|ria\.ru|interfax|press[\-_]?conf|пресс[\-_]?конф|suzuki[\-_]?jimny|jimny|car-search-public|alfaleasing|stock[\-_]?photo[\-_]?car|thumbnail[\-_]?only|motor1|autospies|carscoops|spy[\-_]?shot|test[\-_]?mule|prototype|camo[\-_]?wrap|camouflage[\-_]?wrap|шпион|прототип|камуфляж|pre[\-_]?production|mule[\-_]?car/i;

function isBlockedRasterUrl(url) {
  if (process.env.LISTING_BLOCK_PNG_URL === '0') return false;
  const u = mediaUrlHaystack(url);
  if (/\.(png|gif|bmp|tiff?)(\?|#|$)/i.test(u)) return true;
  if (/\.webp(\?|#|$)/i.test(u) && !/(?:press|official|media-library|static\.(?:sollers|daf|kamaz|maz|ural))/i.test(u)) {
    return true;
  }
  return false;
}

function isJunkPhotoUrl(url) {
  const u = mediaUrlHaystack(url);
  if (JUNK_PHOTO_URL_RE.test(u)) return true;
  if (/[/\-_](?:people|person|portrait|driver|team|family)[/\-_.]/i.test(u)) return true;
  return false;
}

function listingCtxOrCurrent(ctx) {
  return ctx || currentListingCtx;
}

function isBlockedMediaUrl(url, ctx) {
  const c = listingCtxOrCurrent(ctx);
  if (!rejectListingSourceUrl(url).ok) return true;
  if (DEALER_URL.test(url)
    || isMilitaryBlocked(url)
    || isSpyPrototypeBlocked(url)
    || isHumanBodyBlocked(url)
    || isWatermarkBlocked(url)
    || isBlockedRasterUrl(url)
    || isJunkPhotoUrl(url)
    || STOCK.test(url)) {
    return true;
  }
  if (c && urlYearRejected(url).reject) return true;
  if (c && urlModelConflict(url, c.brand, c.model, c.specs).conflict) return true;
  if (c && c.wheelFormula && urlWheelConflict(url, c.wheelFormula).conflict) return true;
  return false;
}

function urlScore(url, brand, model, ctx) {
  const u = url.toLowerCase();
  let score = 0;
  for (const t of modelTokens(brand, model)) {
    if (u.includes(t)) score += 2;
  }
  if (/press|newsroom|media-library|media\.|official|oem|manufacturer|\.com\/news|press-release/.test(u)) score += 3;
  if (/truck|kamaz|maz|ural|daf|renault|zeekr|chassis|shassi|gruz|tractor/.test(u)) score += 1;
  if (/album|music|poster|wallpaper|song|artist|xxx|topgear|wikipedia/.test(u)) score -= 8;
  if (DEALER_URL.test(u)) score -= 12;
  if (!rejectListingSourceUrl(url).ok) score -= 25;
  if (isMilitaryBlocked(u)) score -= 20;
  if (isHumanBodyBlocked(u)) score -= 20;
  if (isWatermarkBlocked(u)) score -= 15;
  const c = listingCtxOrCurrent(ctx);
  if (c) {
    if (urlYearRejected(url).reject) score -= 25;
    if (urlModelConflict(url, c.brand, c.model, c.specs).conflict) score -= 35;
    if (c.wheelFormula && urlWheelConflict(url, c.wheelFormula).conflict) score -= 30;
  }
  return score;
}

function uniqUrls(list) {
  const seen = new Set();
  const out = [];
  for (const url of list) {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url) || STOCK.test(url)) continue;
    if (isBlockedMediaUrl(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

function dims(buf, ext) {
  try {
    if (ext === 'png' && buf.slice(12, 16).toString() === 'IHDR') {
      return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    }
    if (ext === 'jpg') {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        }
        const seglen = buf.readUInt16BE(i + 2);
        if (seglen < 2) break;
        i += 2 + seglen;
      }
    }
  } catch { /* skip */ }
  return null;
}

async function sleepPage(page, ms) {
  try {
    await page.waitForTimeout(ms);
  } catch { /* skip */ }
}

function parseEnvList(raw, fallback) {
  const s = String(raw ?? '').trim();
  const src = s || fallback;
  return [...new Set(src.split(',').map((x) => x.trim()).filter(Boolean))];
}

/** Yandex lr: 213 RU, 102 US, 96 DE, 162 KZ, 149 BY, 124 FR, 983 TR, 134 CN (общ.) */
const YANDEX_IMAGES_ORIGIN = process.env.YANDEX_IMAGES_ORIGIN || 'https://yandex.ru';
const YANDEX_LR_LIST = parseEnvList(
  process.env.YANDEX_LR_LIST,
  '213,162,149',
);
const YANDEX_LR_MODE = process.env.YANDEX_LR_MODE || 'rotate';
const DDG_LOCALE_LIST = parseEnvList(
  process.env.DDG_LOCALE_LIST,
  'ru-ru,kk-kz',
);
const DDG_LOCALE_MODE = process.env.DDG_LOCALE_MODE || 'rotate';
const BING_CC_LIST = parseEnvList(process.env.BING_CC_LIST, 'RU,KZ,BY');

function yandexLrsForQuery(planIdx) {
  if (YANDEX_LR_MODE === 'all') return YANDEX_LR_LIST;
  if (!YANDEX_LR_LIST.length) return ['213'];
  return [YANDEX_LR_LIST[planIdx % YANDEX_LR_LIST.length]];
}


function yandexImagesFilterParams() {
  const out = {};
  const isize = (process.env.YANDEX_ISIZE ?? 'large').trim();
  const itype = (process.env.YANDEX_ITYPE ?? 'photo').trim();
  const iorient = (process.env.YANDEX_IORIENT ?? 'horizontal').trim();
  if (isize) out.isize = isize;
  if (itype) out.itype = itype;
  if (iorient) out.iorient = iorient;
  return out;
}

function yandexImagesSearchUrl(query, lr) {
  const u = new URL(`${YANDEX_IMAGES_ORIGIN}/images/search`);
  u.searchParams.set('text', query);
  for (const [k, v] of Object.entries(yandexImagesFilterParams())) u.searchParams.set(k, v);
  u.searchParams.set('lr', String(lr));
  return u.toString();
}

function ddgLocalesForQuery(planIdx) {
  if (DDG_LOCALE_MODE === 'all') return DDG_LOCALE_LIST;
  if (!DDG_LOCALE_LIST.length) return ['ru-ru'];
  return [DDG_LOCALE_LIST[planIdx % DDG_LOCALE_LIST.length]];
}

async function yandexHitsOne(page, query, lr) {
  await page.goto(yandexImagesSearchUrl(query, lr), { waitUntil: 'domcontentloaded', timeout: GOTO_MS });
  await sleepPage(page, 850);
  if (/showcaptcha/i.test(page.url())) return [];
  const html = await page.content();
  const hits = [];
  for (const m of html.matchAll(/img_url=([^&"']+)/g)) {
    try { hits.push(decodeURIComponent(m[1])); } catch { /* skip */ }
  }
  return hits;
}

async function yandexHits(page, query, planIdx = 0) {
  const lrs = yandexLrsForQuery(planIdx);
  const merged = [];
  for (const lr of lrs) {
    merged.push(...(await yandexHitsOne(page, query, lr)));
  }
  return uniqUrls(merged);
}

async function yandexByUrl(page, imageUrl) {
  const lrs = YANDEX_LR_LIST.length ? YANDEX_LR_LIST.slice(0, 2) : ['213', '162'];
  const merged = [];
  for (const lr of lrs) {
    await page.goto(
      `${YANDEX_IMAGES_ORIGIN}/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}&lr=${encodeURIComponent(lr)}`,
      { waitUntil: 'domcontentloaded', timeout: GOTO_MS },
    );
    await sleepPage(page, 1200);
    const html = await page.content();
    for (const m of html.matchAll(/img_url=([^&"']+)/g)) {
      try { merged.push(decodeURIComponent(m[1])); } catch { /* skip */ }
    }
  }
  return uniqUrls(merged);
}

async function bingHitsOne(page, query, cc) {
  await page.goto(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:photo-photo+filterui:imagesize-large&form=IRFLTR&setlang=en&cc=${encodeURIComponent(cc)}`,
    { waitUntil: 'domcontentloaded', timeout: GOTO_MS },
  );
  await sleepPage(page, 900);
  const html = await page.content();
  const hits = [];
  for (const m of html.matchAll(/murl&quot;:&quot;([^&"]+)|"murl":"(https?:[^"]+)"/g)) {
    try { hits.push(decodeURIComponent(m[1] || m[2])); } catch { /* skip */ }
  }
  return hits;
}

async function bingHits(page, query, planIdx = 0) {
  const mode = process.env.BING_CC_MODE || 'rotate';
  const list = BING_CC_LIST;
  const ccs = mode === 'all'
    ? list
    : [list[planIdx % list.length] || list[0] || 'US'];
  const merged = [];
  for (const cc of ccs) {
    merged.push(...(await bingHitsOne(page, query, cc)));
  }
  return uniqUrls(merged);
}

async function ddgHits(page, query, planIdx = 0) {
  await page.goto(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { waitUntil: 'domcontentloaded', timeout: GOTO_MS },
  );
  await sleepPage(page, 1200);
  const locales = ddgLocalesForQuery(planIdx);
  const packed = await page.evaluate(async ({ q, localeList }) => {
    const html = document.documentElement.innerHTML;
    const match = html.match(/vqd="([^"]+)"/) || html.match(/vqd=([\d-]+)/);
    if (!match) return { images: [] };
    const images = [];
    for (const loc of localeList) {
      const url = `https://duckduckgo.com/i.js?l=${encodeURIComponent(loc)}&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(match[1])}&f=${encodeURIComponent('size:Large,type:photo')}`;
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.status !== 200) continue;
        const data = JSON.parse(await res.text());
        for (const row of data.results || []) {
          if (row.image) images.push(row.image);
        }
      } catch {
        /* next locale */
      }
    }
    return { images };
  }, { q: query, localeList: locales });
  return uniqUrls(packed?.images || []);
}

async function readResponseBody(res, ms) {
  return Promise.race([
    res.arrayBuffer().then((ab) => Buffer.from(ab)),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('body read timeout')), ms);
    }),
  ]);
}

function runVisionCriticSync(buf, ext, row, csvSpecs, wheelFormula) {
  if (process.env.B_VISION_POST === '0') return { pass: true, skipped: true };
  const b64 = buf.toString('base64');
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const payload = JSON.stringify({
    b64,
    mime,
    brand: row.brand,
    model: row.model,
    csvSpecs,
    wheelFormula,
  });
  const run = spawnSync(
    'docker.exe',
    ['exec', '-i', '-w', '/app', 'dapp-backend', 'node', '/app/scripts/listing-photo-vision-critic.js'],
    { input: payload, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024 },
  );
  const parsed = parseSpawnStdoutJson(run.stdout);
  if (!parsed) {
    return { pass: true, skipped: true, reasons: ['vision_parse_error'] };
  }
  return parsed;
}

async function downloadMeta(url, brand, model, segment, listingCtx) {
  let res;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://yandex.com/' },
        signal: AbortSignal.timeout(FETCH_MS),
      });
      break;
    } catch {
      if (attempt === 2) return null;
    }
  }
  if (!res.ok) return null;
  if ((res.headers.get('content-type') || '').includes('text/html')) return null;
  let buf;
  try {
    buf = await readResponseBody(res, BODY_MS);
  } catch {
    return null;
  }
  const ext = sniff(buf);
  if (!ext || !['jpg', 'png', 'webp'].includes(ext)) return null;
  const size = dims(buf, ext);
  if (!size) return null;
  if (isBlockedMediaUrl(url, listingCtx)) return null;
  if (urlScore(url, brand, model, listingCtx) < 0) return null;
  return {
    buf,
    ext,
    w: size[0],
    h: size[1],
    url,
    score: urlScore(url, brand, model, listingCtx),
    digest: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

async function dhashFile(filePath) {
  const { data } = await sharp(filePath)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits += left > right ? '1' : '0';
    }
  }
  return bits;
}

function hamming(a, b) {
  if (!a || !b) return 999;
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) n += 1;
  return n;
}

function normalizeTitleKey(title) {
  return String(title || '')
    .replace(/\u00b7|·/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function catalogByTitle(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.title, row);
    const key = normalizeTitleKey(row.title);
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

function isDealerSource(item) {
  return Boolean(item?.url && DEALER_URL.test(item.url));
}

function isRejectedSource(item) {
  return Boolean(item?.url && isBlockedMediaUrl(item.url));
}

function refCandidateScore(item, brand, model) {
  if (isRejectedSource(item)) return -999;
  if (!item?.hash) {
    let score = Number.isFinite(item.score) ? item.score : urlScore(item.url || '', brand, model);
    if (item.bucket === 'front' || item.bucket === 'side' || item.bucket === 'front34') score += 2;
    return score - 3;
  }
  let score = Number.isFinite(item.score) ? item.score : urlScore(item.url || '', brand, model);
  const u = String(item.url || '').toLowerCase();
  if (/press|newsroom|official|media-library|media\.|\/news\/|press-release/.test(u)) score += 5;
  if (item.bucket === 'front' || item.bucket === 'side' || item.bucket === 'front34') score += 3;
  else if (item.bucket === 'work' || item.bucket === 'detail') score += 2;
  else if (item.bucket === 'any') score += 1;
  else if (item.bucket === 'cabin') score += 0;
  else if (item.bucket === 'reverse') score -= 1;
  return score;
}

function pickIdentityRef(saved, brand, model) {
  const candidates = saved.filter((s) => !isRejectedSource(s) && (s.hash || s.url));
  if (!candidates.length) return null;
  let ref = [...candidates].sort(
    (a, b) => refCandidateScore(b, brand, model) - refCandidateScore(a, brand, model),
  )[0];
  if (ref.hash) {
    const cluster = candidates.filter((s) => s.hash && hamming(s.hash, ref.hash) <= 10);
    ref = cluster.sort((a, b) => {
      const ds = refCandidateScore(b, brand, model) - refCandidateScore(a, brand, model);
      if (ds !== 0) return ds;
      return Math.max(b.w, b.h) - Math.max(a.w, a.h);
    })[0] || ref;
  }
  return ref;
}

function fetchLlmCascadeMeta(row) {
  const payload = JSON.stringify({ row, model: QUERY_GEN_MODEL });
  const run = spawnSync(
    'docker.exe',
    ['exec', '-i', '-w', '/app', 'dapp-backend', 'node', '/tmp/gen-listing-search-queries.js'],
    { input: payload, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  if (run.status !== 0) {
    throw new Error((run.stderr || run.stdout || `LLM helper exit ${run.status}`).slice(0, 300));
  }
  const blob = `${run.stdout || ''}\n${run.stderr || ''}`;
  const match = blob.match(/\{[\s\S]*\}\s*$/);
  if (!match) throw new Error(`no JSON in LLM helper output: ${blob.slice(0, 160)}`);
  const parsed = JSON.parse(match[0]);
  if (parsed.error) throw new Error(parsed.error);
  return parsed;
}

function minHammingToPicked(hash, picked) {
  if (!hash || !picked.length) return 999;
  const ds = picked.filter((p) => p.hash).map((p) => hamming(hash, p.hash));
  return ds.length ? Math.min(...ds) : 999;
}

function pickEight(items, refHash, brand, model) {
  const pool = items.filter((it) => it.hash);
  if (!pool.length) {
    return [...items]
      .filter((it) => !isRejectedSource(it))
      .sort((a, b) => refCandidateScore(b, brand, model) - refCandidateScore(a, brand, model))
      .slice(0, 8);
  }
  const picked = [];
  const used = new Set();
  const maxReverse = Math.max(0, Number(process.env.MAX_REVERSE_IN_PICK || 1));
  const reverseCount = () => picked.filter((p) => p.bucket === 'reverse').length;
  const bucketOrder = ['front34', 'front', 'side', 'rear', 'work', 'cabin', 'detail', 'any', 'reverse'];

  const chooseBest = (candidates) => {
    let best = null;
    let bestKey = -1;
    for (const cand of candidates) {
      if (used.has(cand.file)) continue;
      const spread = minHammingToPicked(cand.hash, picked);
      if (picked.length && spread < PICK_MIN_HAMMING) continue;
      const key = spread * 1000 + refCandidateScore(cand, brand, model);
      if (key > bestKey) {
        bestKey = key;
        best = cand;
      }
    }
    return best;
  };

  for (const bucket of bucketOrder) {
    if (picked.length >= 8) break;
    if (bucket === 'reverse' && reverseCount() >= maxReverse) continue;
    const cands = pool
      .filter((it) => !used.has(it.file) && it.bucket === bucket)
      .sort((a, b) => refCandidateScore(b, brand, model) - refCandidateScore(a, brand, model));
    const pick = chooseBest(cands);
    if (pick) {
      used.add(pick.file);
      picked.push(pick);
    }
  }

  const rest = pool
    .filter((it) => !used.has(it.file))
    .sort((a, b) => {
      const spreadA = minHammingToPicked(a.hash, picked);
      const spreadB = minHammingToPicked(b.hash, picked);
      if (spreadA !== spreadB) return spreadB - spreadA;
      return refCandidateScore(b, brand, model) - refCandidateScore(a, brand, model);
    });
  for (const cand of rest) {
    if (picked.length >= 8) break;
    if (cand.bucket === 'reverse' && reverseCount() >= maxReverse) continue;
    const spread = minHammingToPicked(cand.hash, picked);
    if (picked.length && spread < PICK_MIN_HAMMING) continue;
    used.add(cand.file);
    picked.push(cand);
  }

  if (picked.length < 8) {
    for (const it of pool) {
      if (picked.length >= 8) break;
      if (used.has(it.file) || isRejectedSource(it)) continue;
      const spread = minHammingToPicked(it.hash, picked);
      if (picked.length && spread < PICK_MIN_HAMMING) continue;
      used.add(it.file);
      picked.push(it);
    }
  }
  return picked.slice(0, 8);
}

function pickCoverage(items, refHash, brand, model) {
  return pickEight(items, refHash, brand, model).length;
}

function resolveCardList(blogLimit, blogSkip, blogTake) {
  const idEnv = process.env.PAGE_IDS || process.env.TEST_IDS;
  if (idEnv) {
    const ids = parsePageIds(idEnv);
    const run = spawnSync(
      'docker.exe',
      ['exec', '-w', '/app', 'dapp-backend', 'node', '-e', `
const db=require('./db');
(async()=>{
  const ids=${JSON.stringify(ids)};
  const {rows}=await db.getQuery()(
    'SELECT id, title FROM admin_pages_simple WHERE id = ANY($1::int[])',
    [ids],
  );
  const order=new Map(ids.map((id,i)=>[id,i]));
  rows.sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
  console.log(JSON.stringify(rows));
  process.exit(0);
})().catch((e)=>{console.error(e);process.exit(1);});
`],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    if (run.status !== 0) {
      throw new Error((run.stderr || run.stdout || 'resolve ids failed').slice(0, 300));
    }
    return JSON.parse(run.stdout.trim());
  }
  let top = JSON.parse(execSync(
    `curl -sS 'http://localhost:9000/api/pages/blog/all' | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps([{'id':p['id'],'title':p['title']} for p in d[:${blogLimit}]]))"`,
    { encoding: 'utf8' },
  ));
  if (blogSkip > 0 || blogTake > 0) {
    const end = blogTake > 0 ? blogSkip + blogTake : undefined;
    top = top.slice(blogSkip, end);
  }
  return top;
}

async function main() {
  acquireSearchLock();
  try {
  if (process.env.INCREMENTAL_ATTACH === '1') {
    ensureDockerListingBScripts();
  }
  const blogLimit = Number(process.env.BLOG_LIMIT || 15);
  const blogSkip = Number(process.env.BLOG_SKIP || 0);
  const blogTake = Number(process.env.BLOG_TAKE || 0);
  const top = resolveCardList(blogLimit, blogSkip, blogTake);
  log({
    phase: 'queue',
    total: top.length,
    order: top.map((c) => c.id),
    incrementalAttach: process.env.INCREMENTAL_ATTACH === '1',
    searchRegions: {
      yandexLr: YANDEX_LR_LIST,
      yandexLrMode: YANDEX_LR_MODE,
      ddgLocales: DDG_LOCALE_LIST,
      ddgLocaleMode: DDG_LOCALE_MODE,
      bingCc: BING_CC_LIST,
      engines: (process.env.IMAGE_ENGINES || 'yandex').split(',').map((s) => s.trim()).filter(Boolean).filter((e) => e !== 'duckduckgo' && e !== 'ddg'),
    },
  });
  const engineList = (process.env.IMAGE_ENGINES || 'yandex')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((e) => e !== 'duckduckgo' && e !== 'ddg');
  const runners = { bing: bingHits, yandex: yandexHits };
  const skipSerp = process.env.SKIP_SERP === '1';
  const catalog = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const byTitle = catalogByTitle(catalog);

  if (process.env.CLEAR_PHOTOS === '1') {
    execSync(
      'docker.exe exec -w /app dapp-backend node scripts/clear-listing-media-2026.js',
      { stdio: 'inherit' },
    );
  }

  if (process.env.KEEP_OBJFIX !== '1') {
    await fsp.rm(ROOT, { recursive: true, force: true });
  }
  await fsp.mkdir(ROOT, { recursive: true });

  if (process.env.QUERY_GEN !== 'rules') {
    execSync(
      `docker.exe cp "${path.join(SCRIPT_DIR, 'gen-listing-search-queries.js')}" dapp-backend:/tmp/gen-listing-search-queries.js`,
      { stdio: 'pipe' },
    );
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const pageOpts = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
  };
  let page = await browser.newPage(pageOpts);

  async function resetBrowserPage(reason, cardId) {
    log({ id: cardId, phase: 'browser', reset: reason });
    try { await page.close(); } catch { /* ignore */ }
    page = await browser.newPage(pageOpts);
  }

  async function runEngineHits(cardId, engine, run, query) {
    try {
      const hits = await run(page, query);
      return { hits: hits || [], failed: false };
    } catch (e) {
      log({ id: cardId, engine, error: String(e.message || e).slice(0, 120) });
      return { hits: [], failed: true };
    }
  }

  for (let seq = 0; seq < top.length; seq += 1) {
    const card = top[seq];
    const row = byTitle.get(card.title) || byTitle.get(normalizeTitleKey(card.title));
    if (!row) {
      log({ seq: seq + 1, total: top.length, id: card.id, title: card.title, skip: 'no catalog row' });
      continue;
    }
    const dest = path.join(ROOT, String(card.id));
    await fsp.mkdir(dest, { recursive: true });

    const product = `${row.brand} ${row.model}`.replace(/\s+/g, ' ').trim();
    const titlePlain = (row.title || product).replace(/\s*·\s*/g, ' ').trim();
    const csvSpecs = specsFromDescription(row.description);
    const wheelFormula = parseWheelFormula(csvSpecs);
    currentListingCtx = {
      brand: row.brand,
      model: row.model,
      specs: csvSpecs,
      wheelFormula,
    };
    const hint = bodyHint(row.description, row.segment);

    let baseHints = [];
    let tails = null;
    let llmPart = 'rules';
    let enrichQuery = `${titlePlain} ${shortCsvHint(row)} описание характеристики`.replace(/\s+/g, ' ').trim();

    if (process.env.QUERY_GEN !== 'rules') {
      try {
        const llm = fetchLlmCascadeMeta(row);
        llmPart = llm.source || 'llm';
        if (llm.enrichQuery) enrichQuery = llm.enrichQuery;
        baseHints = llm.baseHints || [];
        tails = llm.tails || null;
        if (llm.llmError) log({ id: card.id, llmError: llm.llmError });
      } catch (e) {
        log({ id: card.id, llmError: String(e.message || e).slice(0, 160) });
      }
    }

    let serpTerms = [];
    if (!skipSerp) {
      try {
        serpTerms = await serpEnrichTerms(page, enrichQuery, row.brand, row.model);
      } catch (e) {
        log({ id: card.id, enrichError: String(e.message || e).slice(0, 120) });
      }
    }
    const searchBase = composeSearchBase(row, baseHints, serpTerms);
    const plans = buildPhotoPlans(searchBase, row, hint, tails);
    const querySource = `cascade+${llmPart}`;

    log({
      seq: seq + 1,
      total: top.length,
      id: card.id,
      title: card.title,
      querySource,
      queryModel: process.env.QUERY_GEN !== 'rules' ? QUERY_GEN_MODEL : undefined,
      enrichQuery,
      csvSpecs,
      baseHints,
      serpTerms,
      searchBase,
      queryCount: plans.length,
      plans: plans.map((p) => p.q),
    });

    const usedDigest = new Set();
    const saved = [];
    const seenUrl = new Set();
    const warnings = [];
    let ref = null;
    let lastAttachedPickCount = 0;

    async function flushManifestAndAttach() {
      for (const item of saved) {
        if (!item.hash) {
          try {
            item.hash = await dhashFile(path.join(dest, item.file));
          } catch {
            item.hash = null;
          }
        }
      }
      const refNow = ref || pickIdentityRef(saved, row.brand, row.model);
      const refHash = refNow?.hash || null;
      const picked = pickEight(saved, refHash, row.brand, row.model);
      await fsp.mkdir(dest, { recursive: true });
      await fsp.writeFile(
        path.join(dest, 'manifest.json'),
        JSON.stringify({
          planVersion: PLAN_VERSION,
          id: card.id,
          title: card.title,
          querySource,
          queryModel: process.env.QUERY_GEN !== 'rules' ? QUERY_GEN_MODEL : undefined,
          enrichQuery,
          csvSpecs,
          baseHints,
          serpTerms,
          searchBase,
          ref: refNow,
          saved: saved.length,
          picked,
          queries: plans.map((p) => ({ phase: p.phase, bucket: p.bucket, q: p.q })),
          warnings,
        }, null, 2),
      );
      const attachMin = Math.max(1, Number(process.env.ATTACH_MIN || 1));
      const milestoneOk = ATTACH_MILESTONES.includes(picked.length) || picked.length >= 8;
      if (
        process.env.INCREMENTAL_ATTACH === '1'
        && picked.length >= attachMin
        && picked.length > lastAttachedPickCount
        && milestoneOk
      ) {
        try {
          syncAndAttachCard(card.id);
          lastAttachedPickCount = picked.length;
          log({
            id: card.id,
            phase: 'attach-live',
            picked: picked.length,
            saved: saved.length,
          });
        } catch (e) {
          log({
            id: card.id,
            phase: 'attach-live',
            attachError: String(e.message || e).slice(0, 200),
          });
        }
      }
      if (refNow && !ref) ref = refNow;
      return picked;
    }

    async function ingestUrl(url, bucket, engine, query) {
      if (seenUrl.has(url) || saved.length >= MAX_SAVED) return;
      if (isBlockedMediaUrl(url)) return;
      seenUrl.add(url);
      try {
        const got = await downloadMeta(url, row.brand, row.model, row.segment, currentListingCtx);
        if (!got || usedDigest.has(got.digest)) return;
        const vision = runVisionCriticSync(got.buf, got.ext, row, csvSpecs, wheelFormula);
        if (!vision.pass) return;
        const norm = await normalizeListingBuffer(got.buf);
        const pixel = await runPixelHeuristicGate(norm.buf);
        if (!pixel.pass) {
          log({ id: card.id, pixelReject: pixel.reasons, url: String(url).slice(0, 100) });
          return;
        }
        usedDigest.add(got.digest);
        const fileName = `${saved.length + 1}.jpg`;
        const filePath = path.join(dest, fileName);
        await fsp.writeFile(filePath, norm.buf);
        let hash = null;
        try {
          hash = await dhashFile(filePath);
        } catch { /* skip */ }
        if (hash) {
          for (const s of saved) {
            if (s.hash && hamming(s.hash, hash) < INGEST_MIN_HAMMING) {
              await fsp.unlink(filePath).catch(() => {});
              return;
            }
          }
        }
        saved.push({
          file: fileName,
          bucket,
          engine,
          query,
          url: got.url,
          score: got.score,
          w: norm.w,
          h: norm.h,
          hash,
        });
        if (process.env.INCREMENTAL_ATTACH === '1') {
          await flushManifestAndAttach();
        }
      } catch (e) {
        log({ id: card.id, ingest: String(e.message || e).slice(0, 120), url: String(url).slice(0, 100) });
      }
    }

    let engineFailStreak = 0;
    let browserResetOnce = false;
    let planIdx = 0;
    let stalePlans = 0;
    const stalePlansStop = Math.max(0, Number(process.env.SEARCH_STALE_PLANS_STOP || 3));
    planLoop: for (const plan of plans) {
      if (saved.length >= MAX_SAVED) break;
      const savedAtPlanStart = saved.length;
      if (pickCoverage(saved, null, row.brand, row.model) >= CARD_PHOTO_TARGET && saved.length >= CARD_PHOTO_TARGET) {
        log({ id: card.id, earlyStop: 'pick-eight-ready', saved: saved.length });
        break;
      }
      const engineRuns = engineList
        .map((engine) => ({ engine, run: runners[engine] }))
        .filter((x) => x.run);
      const hitSets = await Promise.all(
        engineRuns.map(async ({ engine, run }) => {
          const tab = await browser.newPage(pageOpts);
          try {
            const hits = await run(tab, plan.q, planIdx);
            return { engine, result: { hits: hits || [], failed: false } };
          } catch (e) {
            log({ id: card.id, engine, error: String(e.message || e).slice(0, 120) });
            return { engine, result: { hits: [], failed: true } };
          } finally {
            try { await tab.close(); } catch { /* ignore */ }
          }
        }),
      );
      let planHits = 0;
      for (const { engine, result } of hitSets) {
        const hits = result.hits || [];
        planHits += hits.length;
        log({ id: card.id, phase: 'photo', engine, q: plan.q, hits: hits.length });
        if (hits.length === 0 && result.failed) {
          engineFailStreak += 1;
        } else if (hits.length > 0) {
          engineFailStreak = 0;
        }
        hits.sort((a, b) => urlScore(b, row.brand, row.model) - urlScore(a, row.brand, row.model));
        const takePerPlan = Math.max(1, Number(process.env.SEARCH_TAKE_PER_PLAN || 1));
        const tryEnv = String(process.env.SEARCH_TRY_PER_PLAN ?? '').trim().toLowerCase();
        const tryUnlimited = tryEnv === '0' || tryEnv === 'all' || tryEnv === 'unlimited';
        const tryPerPlan = tryUnlimited
          ? Number.POSITIVE_INFINITY
          : Math.max(
            takePerPlan,
            Number(process.env.SEARCH_TRY_PER_PLAN || Math.max(6, takePerPlan * 4)),
          );
        let planSaved = 0;
        let tried = 0;
        for (const url of hits) {
          if (planSaved >= takePerPlan) break;
          if (tried >= tryPerPlan) break;
          if (saved.length >= MAX_SAVED || saved.length >= CARD_PHOTO_TARGET) break;
          tried += 1;
          const before = saved.length;
          await ingestUrl(url, plan.bucket || 'any', engine, plan.q);
          if (saved.length > before) planSaved += 1;
        }
      }
      if (engineFailStreak >= ENGINE_FAIL_STREAK_MAX) {
        if (!browserResetOnce) {
          await resetBrowserPage('engine_fail_streak', card.id);
          browserResetOnce = true;
          engineFailStreak = 0;
          continue planLoop;
        }
        log({ id: card.id, abort: 'engine_fail_streak', streak: engineFailStreak });
        break planLoop;
      }
      if (pickCoverage(saved, null, row.brand, row.model) >= CARD_PHOTO_TARGET && saved.length >= CARD_PHOTO_TARGET) break planLoop;
      if (saved.length === savedAtPlanStart) {
        stalePlans += 1;
      } else {
        stalePlans = 0;
      }
      // Не обрывать plan loop до ATTACH_TARGET: иначе при 1 saved + 3 «пустых» plan не доходим до 5-й камеры.
      if (
        stalePlansStop > 0
        && stalePlans >= stalePlansStop
        && saved.length >= CARD_PHOTO_TARGET
      ) {
        log({ id: card.id, earlyStop: 'stale_plans', stalePlans, saved: saved.length });
        break planLoop;
      }
      if (planHits === 0 && engineFailStreak >= Math.ceil(ENGINE_FAIL_STREAK_MAX / 2)) {
        log({ id: card.id, warn: 'plan_zero_hits', q: plan.q.slice(0, 80) });
      }
      planIdx += 1;
    }

    for (const item of saved) {
      if (!item.hash) {
        try { item.hash = await dhashFile(path.join(dest, item.file)); } catch { item.hash = null; }
      }
    }
    ref = pickIdentityRef(saved, row.brand, row.model);
    if (ref) {
      log({
        id: card.id,
        ref: ref.file,
        refUrl: ref.url,
        refScore: refCandidateScore(ref, row.brand, row.model),
        cluster: saved.filter((s) => s.hash && hamming(s.hash, ref.hash) <= 10).length,
      });
      const pickedBeforeReverse = pickCoverage(saved, ref.hash, row.brand, row.model);
      const reverseMin = Number(process.env.REVERSE_MIN_PICKED || CARD_PHOTO_TARGET);
      const reverseAllowed = process.env.REVERSE_SEARCH === '1'
        || (process.env.REVERSE_IF_SHORT !== '0' && pickedBeforeReverse < reverseMin);
      if (reverseAllowed && pickedBeforeReverse < CARD_PHOTO_TARGET) {
        const revResult = await runEngineHits(card.id, 'yandex-cbir', (p) => yandexByUrl(p, ref.url), ref.url);
        const revHits = revResult.hits || [];
        const revTake = Math.min(4, Math.max(0, 8 - pickedBeforeReverse));
        for (const url of revHits.slice(0, revTake)) {
          await ingestUrl(url, 'reverse', 'yandex-cbir', ref.url);
        }
        log({ id: card.id, phase: 'reverse', hits: revHits.length, taken: revTake });
      } else {
        log({
          id: card.id,
          phase: 'reverse',
          skip: pickedBeforeReverse >= 8 ? 'pick-eight-ready' : 'reverse_disabled_or_enough',
          pickedBeforeReverse,
        });
      }
    } else if (saved.length) {
      warnings.push('no identity ref');
    } else {
      warnings.push('no photos ingested');
    }

    const picked = await flushManifestAndAttach();
    log({
      seq: seq + 1,
      total: top.length,
      id: card.id,
      title: card.title,
      saved: saved.length,
      picked: picked.length,
      buckets: picked.map((p) => p.bucket),
      warnings: warnings.length ? warnings : undefined,
    });
    const attachMin = Math.max(1, Number(process.env.ATTACH_MIN || 1));
    if (
      process.env.INCREMENTAL_ATTACH === '1'
      && picked.length >= attachMin
      && picked.length > lastAttachedPickCount
    ) {
      try {
        syncAndAttachCard(card.id);
      } catch (e) {
        log({ seq: seq + 1, id: card.id, phase: 'attach', attachError: String(e.message || e).slice(0, 200) });
      }
    }
  }

  await browser.close();
  log({ finished: true });
  } finally {
    releaseSearchLock();
  }
}

main().catch((e) => {
  releaseSearchLock();
  console.error(e);
  process.exit(1);
});
