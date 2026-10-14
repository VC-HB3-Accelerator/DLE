'use strict';

/** Добавить news-agency hosts в listingPhotoSourcePolicy (docker exec). */
const fs = require('fs');
const p = '/app/services/listingPool/listingPhotoSourcePolicy.js';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('tass.ru')) {
  console.log(JSON.stringify({ ok: true, skipped: 'already_patched' }));
  process.exit(0);
}
const needle = 'vahtovka\\.com|amazon\\.com';
const insert = 'vahtovka\\.com|tass\\.ru|tass\\.com|tassphoto\\.ru|ria\\.ru|interfax\\.ru|rbc\\.ru|lenta\\.ru|kommersant\\.ru|mk\\.ru|kp\\.ru|rt\\.com|amazon\\.com';
if (!s.includes(needle)) {
  console.error(JSON.stringify({ ok: false, error: 'host_re_not_found' }));
  process.exit(1);
}
s = s.replace(needle, insert);
const pathNeedle = `const JUNK_PATH_RE =
  /pinterest|wallpaper|wikipedia`;
const pathInsert = `const NEWS_PATH_RE =
  /(?:^|[\\/_.-])(?:tass|ria\\.ru|interfax|press[\\-_]?conf|пресс[\\-_]?конф|круглый[\\-_]?стол|\\/news\\/|\\/article\\/|navigats|navigation[\\-_]|conference[\\-_]?room|briefing|сми)/i;

const JUNK_PATH_RE =
  /pinterest|wallpaper|wikipedia`;
if (!s.includes(pathNeedle)) {
  console.error(JSON.stringify({ ok: false, error: 'junk_path_not_found' }));
  process.exit(1);
}
s = s.replace(pathNeedle, pathInsert);
s = s.replace(
  `  if (JUNK_PATH_RE.test(low)) {
    return { ok: false, reason: 'junk_path' };
  }`,
  `  if (NEWS_PATH_RE.test(low)) {
    return { ok: false, reason: 'news_agency_path' };
  }
  if (JUNK_PATH_RE.test(low)) {
    return { ok: false, reason: 'junk_path' };
  }`,
);
fs.writeFileSync(p, s);
console.log(JSON.stringify({ ok: true, patched: p }));
