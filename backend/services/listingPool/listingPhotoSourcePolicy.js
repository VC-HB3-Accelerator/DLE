'use strict';

const { urlYearRejected } = require('./listingPhotoUrlPolicy.js');

const PRESS_DEALER_HOST_RE =
  /(?:^|\.)(?:gruzovikpress\.ru|gruzovik\.com|kamaz45\.ru|zhaikpress\.kz|korib\.ru|remkam\.ru|savingurals\.com|happihouse\.ru|bigcar\.sale|km124\.ru|rtamg\.com|yarmaz\.ru|kamazik\.ru|linemedia\.com|media\.au\.ru|avto-master\.com|truck-holding\.ru|avtofurgon\.ru|thegamerimages\.com|simpalsmedia\.com|ixbt\.site|media\.ixbt\.site|gird\.ru|dvizhuch\.ru|cranecentr\.ru|specneftemash\.ru|av-grad\.ru|hidromak\.ru|vahtovka\.com|tass\.ru|tass\.com|tassphoto\.ru|ria\.ru|interfax\.ru|rbc\.ru|lenta\.ru|kommersant\.ru|mk\.ru|kp\.ru|rt\.com|amazon\.com|media-amazon\.com|m\.media-amazon\.com)/i;

/** Объявления, лизинг, агрегаторы — не заводские пресс-фото (частые дубли в медиатеке). */
const CLASSIFIED_LEASING_HOST_RE =
  /(?:^|\.)(?:avito\.ru|auto\.ru|drom\.ru|autospot\.ru|alfaleasing\.ru|truck\.ru|gruzovik\d*\.ru|carprice\.ru|freshauto\.ru|carmart\.ru|encar\.com|baltleasing\.ru|gazpromleasing\.ru|sberleasing\.ru|vtbleasing\.ru|europlan\.ru|reso[\-_]?leasing|carcopy\.ru|carrot\.ru|major[\-_]?auto|rolf\.ru|avilon\.ru|avtomir\.ru|ascgroup\.ru|stpulscen\.ru|pulscen\.ru|ixbt\.com|ixbt\.site)/i;

const CLASSIFIED_LEASING_PATH_RE =
  /(?:^|[\/_\-\.])(?:car-search-public|car-search[\-_]?public|alfaleasing|get-autoru-vos|autoru-vos|avatars\.avto|(?:^|[/.])au\.ru\/|linemedia\.com|avto-master\.com|truck-holding\.ru|avtofurgon\.ru|\.dealer|dealer-|classified|объявлен|8-800|tel:|promo[\-_]?banner|thompsoncommercials|autotrader|leasing[\-_]?catalog|subleasing|lizing|_next\/image|car-search\/|\/search\/car|stock[\-_]?photo[\-_]?car|used[\-_]?truck[\-_]?sale|б[\s\-]?у[\s\-]?груз)/i;

/** Шпионские/прототипные кадры (камуфляж, mule, motor1) — не заводской пресс. */
const SPY_PROTOTYPE_HOST_RE =
  /(?:^|\.)(?:motor1\.com|autospies\.com|carscoops\.com|worldcarfans\.com|automobilemag\.com)/i;

const SPY_PROTOTYPE_PATH_RE =
  /(?:^|[\/_\-\.])(?:spy[\-_]?shot|spy[\-_]?photo|spied|test[\-_]?mule|prototype|prototyp|pre[\-_]?production|camo[\-_]?wrap|camouflage[\-_]?(?:wrap|car|vehicle)|mule[\-_]?car|disguised[\-_]?car|erlko[\-_]?nig|шпион(?:ское|ские|ский|ских)?|прототип|камуфляж|испытатель(?:ь|ьный)?|motor1|autospies|carscoops)/i;

const PRESS_DEALER_PATH_RE =
  /gruzovikpress|\/article\/\d+|gp_contents\/|wp-content\/uploads\/(?:201[0-9]|202[0-4])\//i;

const NEWS_PATH_RE =
  /(?:^|[\/_.-])(?:tass|ria\.ru|interfax|press[\-_]?conf|пресс[\-_]?конф|круглый[\-_]?стол|\/news\/|\/article\/|navigats|navigation[\-_]|conference[\-_]?room|briefing|сми)/i;

const JUNK_PATH_RE =
  /pinterest|wallpaper|wikipedia|\.pinterest\.|blog[\-_]?post|news\/img\/|robot[\-_]|viber_|car-search-public|alfaleasing|stpulscen|pulscen\.|yandexcloud\.net\/car-search/i;

const NON_PHOTO_PATH_RE =
  /illustration|clip[\-_]?art|\/sketch\/|cartoon|watercolor|infographic|vector[\-_]art|blueprint|technical[\-_]drawing|renderhub|\/cgi\/|3d[\-_]render|isometric[\-_]render|stock[\-_]vector/i;

const PARTS_CATALOG_PATH_RE =
  /zapchast|zapchasti|\/zapchasti\/|\/parts\/|spare[\-_]parts|autoparts|\/detal[iy]\/|komplektuyush|запчаст|комплектующ|only[\-_]engine|engine[\-_]only|gearbox|turbocharger|clutch[\-_]|brake[\-_]pad|brake[\-_]disc|oil[\-_]filter|piston|crankshaft|cardan[\-_]shaft|насос|поршн|коленвал|гбц|фильтр[\-_]масл/i;

const BUILDING_PATH_RE =
  /real[\-_]estate|\/architecture\/|office[\-_]building|residential[\-_]building|skyscraper|apartment[\-_]building|жил[\s\-_]?дом|многоквартир|котедж|офисное[\s\-_]?здан|фасад[\s\-_]?здан|warehouse[\-_]only|factory[\-_]facade/i;

const PEOPLE_PATH_RE =
  /\/people\/|\/person\/|staff[\-_]?photo|team[\-_]?photo|driver[\-_]?portrait|portrait[\-_]|celebrity|red[\-_]?carpet|с[\s\-_]?(?:люд|челов|рабоч|водител)|group[\-_]?photo|family[\-_]?photo/i;

const AWARDS_PATH_RE =
  /trophy|cup[\-_]award|\/awards\/|medal[\-_]ceremony|prize[\-_]ceremony|награда|кубок|награжден|awards[\-_]night|golden[\-_]cup/i;

const SPACE_PATH_RE =
  /\/space\/|astronaut|cosmonaut|nasa|roscosmos|спутник|космос|cosmos|galaxy|nebula|milky[\-_]way|planet[\-_]|mars[\-_]rover|iss[\-_]|мкс|ракета[\-_]nos/i;

const CITY_PATH_RE =
  /cityscape|skyline|panorama[\-_]city|urban[\-_]landscape|night[\-_]city|город[\-_]ноч|достопримеч|landmark[\-_]city|aerial[\-_]city|городской[\-_]пейзаж/i;

const VINTAGE_PATH_RE =
  /vintage[\-_]photo|old[\-_]photo|retro[\-_]photo|black[\-_]and[\-_]white|black[\-_]white|b[\-_]?w[\-_]photo|sepia|archival[\-_]photo|historical[\-_]photo|старинн|ретро[\-_]фото|ч[\-_]?б[\-_]фото|черно[\-_]бел/i;

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function rejectListingSourceUrl(url) {
  const u = String(url || '');
  if (!u) return { ok: true };
  const low = u.toLowerCase();
  const host = hostOf(u);
  if (CLASSIFIED_LEASING_HOST_RE.test(host) || CLASSIFIED_LEASING_PATH_RE.test(low)) {
    return { ok: false, reason: 'classified_leasing_url' };
  }
  if (SPY_PROTOTYPE_HOST_RE.test(host) || SPY_PROTOTYPE_PATH_RE.test(low)) {
    return { ok: false, reason: 'spy_prototype_url' };
  }
  if (PRESS_DEALER_HOST_RE.test(host) || PRESS_DEALER_HOST_RE.test(low)) {
    return { ok: false, reason: 'press_dealer_host' };
  }
  if (PRESS_DEALER_PATH_RE.test(low)) {
    return { ok: false, reason: 'press_dealer_path' };
  }
  if (NEWS_PATH_RE.test(low)) {
    return { ok: false, reason: 'news_agency_path' };
  }
  if (JUNK_PATH_RE.test(low)) {
    return { ok: false, reason: 'junk_path' };
  }
  if (NON_PHOTO_PATH_RE.test(low)) {
    return { ok: false, reason: 'non_photo_path' };
  }
  if (PARTS_CATALOG_PATH_RE.test(low)) {
    return { ok: false, reason: 'parts_catalog_url' };
  }
  if (BUILDING_PATH_RE.test(low)) {
    return { ok: false, reason: 'building_url' };
  }
  if (PEOPLE_PATH_RE.test(low)) {
    return { ok: false, reason: 'people_url' };
  }
  if (AWARDS_PATH_RE.test(low)) {
    return { ok: false, reason: 'awards_url' };
  }
  if (SPACE_PATH_RE.test(low)) {
    return { ok: false, reason: 'space_url' };
  }
  if (CITY_PATH_RE.test(low)) {
    return { ok: false, reason: 'city_url' };
  }
  if (VINTAGE_PATH_RE.test(low)) {
    return { ok: false, reason: 'vintage_photo_url' };
  }
  const yr = urlYearRejected(u);
  if (yr.reject) {
    return { ok: false, reason: `year_${yr.year}` };
  }
  return { ok: true };
}

module.exports = {
  rejectListingSourceUrl,
  PRESS_DEALER_HOST_RE,
  CLASSIFIED_LEASING_HOST_RE,
  CLASSIFIED_LEASING_PATH_RE,
  SPY_PROTOTYPE_HOST_RE,
  SPY_PROTOTYPE_PATH_RE,
};
