const fs = require('fs');

const existingRu = JSON.parse(fs.readFileSync('src/locales/ru.json', 'utf8'));
const existingEn = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));

// settings tree: [ru, en]
const settings = require('./settings-i18n-data.cjs');

function buildMessages(obj, langIndex) {
  if (Array.isArray(obj)) return obj[langIndex];
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = buildMessages(v, langIndex);
  return out;
}

function countKeys(obj) {
  let n = 0;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string') n++;
    else if (typeof v === 'object' && v !== null) n += countKeys(v);
  }
  return n;
}

const ruSettings = buildMessages(settings, 0);
const enSettings = buildMessages(settings, 1);

existingRu.common = { ...(existingRu.common || {}), ...ruSettings.common };
delete ruSettings.common;
existingEn.common = { ...(existingEn.common || {}), ...enSettings.common };
delete enSettings.common;

existingRu.settings = ruSettings;
existingEn.settings = enSettings;

fs.writeFileSync('src/locales/ru.json', JSON.stringify(existingRu, null, 2) + '\n');
fs.writeFileSync('src/locales/en.json', JSON.stringify(existingEn, null, 2) + '\n');

console.log('settings keys:', countKeys(ruSettings));
console.log('common keys merged:', countKeys(buildMessages({ common: settings.common }, 0)));
