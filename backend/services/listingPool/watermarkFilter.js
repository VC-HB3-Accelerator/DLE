'use strict';

/**
 * Reject watermarked / stock-preview images before they enter _pool.
 * Layer 1: URL/host heuristics (hard reject).
 * Layer 2: optional vision critic after download.
 */

const STOCK_HOST_RE =
  /(?:^|\.)(?:shutterstock|depositphotos|gettyimages|istockphoto|adobe\.stock|stock\.adobe|ftcdn\.net|dreamstime|alamy|123rf|fotolia|pond5|agefotostock|bigstockphoto|canstockphoto|vectorstock|pngtree|pngimg|freepik|rawpixel|envato|elements\.envato|turbosquid|hdpic\.club|png\.wing|lovepik|588ku)/i;

/** RU aggregators that stamp watermarks on photos */
const AGGREGATOR_WM_HOST_RE =
  /(?:^|\.)(?:drom\.ru|auto\.drom\.ru|s\d*\.auto\.drom\.ru|avito\.ru|youla\.ru|farpost\.ru|bibika\.ru|cars\.ru|linemedia\.com|media\.au\.ru|avto-master\.com|truck-holding\.ru|avtofurgon\.ru|motor1\.com|autospies\.com|carscoops\.com)/i;

const WATERMARK_URL_RE =
  /watermark|wm[_-]?preview|stock[_-]?photo|editorial[_-]?use|preview[_-]?only|with[_-]?watermark|stamp[_-]?preview|comp[_-]?image|\/comp\/|\/preview\/|\/watermarked\/|whatsapp[\s_-]?image|fit_q87\/|ts-thumb\//i;

const BANNER_URL_RE =
  /banner|promo[_-]?slide|og[_-]?share[_-]?default|placeholder|no[_-]?photo|coming[_-]?soon/i;

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Hard reject before download.
 * @returns {{ ok: boolean, reason?: string }}
 */
function rejectWatermarkUrl(url) {
  const u = String(url || '');
  if (!u) return { ok: false, reason: 'empty' };
  const host = hostOf(u);
  if (STOCK_HOST_RE.test(host) || STOCK_HOST_RE.test(u)) {
    return { ok: false, reason: 'stock_host' };
  }
  if (AGGREGATOR_WM_HOST_RE.test(host) || AGGREGATOR_WM_HOST_RE.test(u)) {
    return { ok: false, reason: 'aggregator_watermark_host' };
  }
  if (WATERMARK_URL_RE.test(u)) {
    return { ok: false, reason: 'watermark_url' };
  }
  if (BANNER_URL_RE.test(u)) {
    return { ok: false, reason: 'banner_url' };
  }
  if (/i\.ytimg\.com|youtube\.com/i.test(host)) {
    return { ok: false, reason: 'youtube_thumb' };
  }
  return { ok: true };
}

/**
 * Vision pass: detect visible watermark / stock stamp / heavy overlay text.
 * Fail-closed only when model is confident; transport errors → soft keep + flag.
 */
async function criticWatermarkFile(filePath, { visionProvider, chatWith, parseJsonLoose } = {}) {
  if (!chatWith || !filePath) {
    return { pass: true, skipped: true };
  }
  const fs = require('fs');
  const buf = fs.readFileSync(filePath);
  if (buf.length > 2.5 * 1024 * 1024) {
    // too large for vision — skip, rely on URL filter
    return { pass: true, skipped: true, reason: 'too_large_for_vision' };
  }
  const mime = filePath.endsWith('.png')
    ? 'image/png'
    : filePath.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';
  const b64 = buf.toString('base64');
  const prompt = `Ты фильтр водяных знаков для объявления техники.
Верни JSON: {"pass":true|false,"score":0..1,"reasons":["..."],"has_watermark":true|false,"has_stock_stamp":true|false,"has_heavy_overlay_text":true|false}

ЖЁСТКИЙ fail (pass=false) если есть:
- водяной знак (watermark) по центру/диагонали/повторяющийся паттерн;
- штамп стока (Shutterstock, Depositphotos, Getty, Adobe Stock, Alamy, 123RF и т.п.);
- крупный полупрозрачный текст поверх фото «STOCK» / сайт-агрегатор;
- логотип/текст агрегатора в углу (дром, Авито, ГК …, URL сайта);
- номерной знак с надписью «дром» / чужим брендом агрегатора вместо номера;
- коллаж с рамками UI поиска картинок.

НЕ fail: маленький логотип бренда на самой машине; обычный заводской шильд.
pass=true только если фото чистое для карточки объявления.`;

  try {
    const { content, model } = await chatWith(
      visionProvider || 'qwen_token',
      [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
      { vision: true, json: true, maxTokens: 500 }
    );
    const parsed = parseJsonLoose(content) || { pass: false, has_watermark: true };
    const hasWm =
      parsed.has_watermark === true ||
      parsed.has_stock_stamp === true ||
      parsed.has_heavy_overlay_text === true;
    let pass = Boolean(parsed.pass) && !hasWm;
    if (hasWm) pass = false;
    return {
      pass,
      score: Number(parsed.score) || (pass ? 0.9 : 0.2),
      reasons: parsed.reasons || [],
      has_watermark: hasWm,
      modelUsed: model,
    };
  } catch (e) {
    return {
      pass: true,
      soft: true,
      skipped: true,
      reasons: [`vision_error:${e.message}`],
    };
  }
}

module.exports = {
  rejectWatermarkUrl,
  criticWatermarkFile,
  STOCK_HOST_RE,
  AGGREGATOR_WM_HOST_RE,
  WATERMARK_URL_RE,
};
