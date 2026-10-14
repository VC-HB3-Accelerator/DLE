'use strict';

/** Доп. URL-блоки для plan B (CDN Yandex часто без семантики в path). */
const NEWS_AGENCY_HOST_RE =
  /(?:^|\.)(?:tass\.(?:ru|com)|tass\.ru|tassphoto\.ru|ria\.ru|interfax\.ru|rbc\.ru|lenta\.ru|gazeta\.ru|kommersant\.ru|mk\.ru|kp\.ru|aif\.ru|rg\.ru|iz\.ru|ura\.news|life\.ru|ren\.tv|ntv\.ru|1tv\.ru|vesti\.ru|rt\.com|russian\.rt\.com|sputniknews|regnum\.ru|fontanka\.ru|fedpress\.ru|news\.mail\.ru|news\.yandex\.ru)/i;

const NEWS_AGENCY_PATH_RE =
  /(?:^|[\/_\-\.])(?:tass|ria\.ru|interfax|\/news\/|\/article\/|press[\-_]?center|press[\-_]?conf|пресс[\-_]?конф|круглый[\-_]?стол|новост|navigats|navigation[\-_]|conference[\-_]?room|briefing|сми|журналист)/i;

const SPORTS_CELEB_RE =
  /neymar|ronaldo|messi|mbappe|football|soccer|fifa|uefa|premier[\-_]?league|champions[\-_]?league|болель|футбол|спортсмен|celebrit|fan[\-_]?zone/i;

const EXHIBITION_RE =
  /exhibition[\-_]?hall|trade[\-_]?show|expo[\-_]?floor|выставк|стенд[\-_]|booth[\-_]|messe[\-_]|convention[\-_]?center/i;

const CARTOON_GAME_RE =
  /roblox|minecraft|fortnite|avatar[\-_]|cartoon|anime|meme[\-_]|sticker[\-_]|emoji|3d[\-_]?character|game[\-_]?asset/i;

const LEASING_AGGREGATOR_RE =
  /car-search-public|car-search[\-_]?public|alfaleasing|storage\.yandexcloud\.net\/car-search|get-autoru-vos|autoru-vos|avatars\.avto|media\.au\.ru|stpulscen|pulscen\.|autospot|europlan|reso[\-_]?leasing|gazpromleasing|sberleasing|vtbleasing|carprice|freshauto|carmart|encar\.com|_next\/image.*(?:leasing|auto|car)/i;

const CLASSIFIED_LISTING_RE =
  /(?:^|[\/_\-\.])(?:avito|auto\.ru|drom\.|truck\.ru|gruzovik\d|classified|объявлен|used[\-_]?truck|б[\s\-]?у[\s\-]?груз|stock[\-_]?vehicle)/i;

const SPY_PROTOTYPE_RE =
  /motor1\.|autospies|carscoops|spy[\-_]?shot|test[\-_]?mule|prototype|camo[\-_]?wrap|camouflage[\-_]?(?:wrap|car|vehicle)|шпион|прототип|камуфляж|pre[\-_]?production|mule[\-_]?car/i;

function extraListingUrlBlocked(url) {
  const u = String(url || '').toLowerCase();
  if (!u) return null;
  let host = '';
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    /* skip */
  }
  if (NEWS_AGENCY_HOST_RE.test(host) || NEWS_AGENCY_HOST_RE.test(u)) return 'news_agency_host';
  if (NEWS_AGENCY_PATH_RE.test(u)) return 'news_agency_path';
  if (SPORTS_CELEB_RE.test(u)) return 'sports_celeb_url';
  if (EXHIBITION_RE.test(u)) return 'exhibition_url';
  if (CARTOON_GAME_RE.test(u)) return 'cartoon_game_url';
  if (LEASING_AGGREGATOR_RE.test(u)) return 'leasing_aggregator_url';
  if (CLASSIFIED_LISTING_RE.test(u)) return 'classified_listing_url';
  if (SPY_PROTOTYPE_RE.test(u)) return 'spy_prototype_url';
  return null;
}

module.exports = {
  extraListingUrlBlocked,
  NEWS_AGENCY_HOST_RE,
};
