#!/usr/bin/env node
/**
 * Безопасная миграция DleDeployFormView: только простой текст в allowlisted тегах.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VUE_FILE = path.join(__dirname, '../src/views/settings/DleDeployFormView.vue');
const LOCALES = path.join(__dirname, '../src/locales');

const ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label', 'button', 'p', 'small', 'strong', 'th', 'td', 'option', 'span', 'div'];

const EN_MAP = {
  'Выберите страну:': 'Select country:',
  '-- Выберите страну --': '-- Select country --',
  'Загрузка стран...': 'Loading countries...',
  'Загрузка российских классификаторов...': 'Loading Russian classifiers...',
  'Юридический адрес': 'Legal address',
  'Почтовый индекс:': 'Postal code:',
  'Поиск': 'Search',
  'Поиск данных по индексу...': 'Searching by postal code...',
  'Проверить адрес': 'Verify address',
  'Очистить': 'Clear',
  'Удалить': 'Delete',
  'Сохранить': 'Save',
  'Добавить': 'Add',
};

function slugify(text) {
  const words = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 5);
  return words.map((w) => w.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '')).filter(Boolean).join('_').slice(0, 40) || 'text';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSafeText(text) {
  if (!text || !/[а-яА-ЯЁё]/.test(text)) return false;
  if (/[<>{}"=@]/.test(text)) return false;
  if (text.length > 200) return false;
  return true;
}

function extractTemplate(content) {
  const m = content.match(/<template>([\s\S]*?)<\/template>/);
  return m ? m[1] : '';
}

function extractStrings(tpl) {
  const found = new Set();
  const tagPattern = ALLOWED_TAGS.join('|');
  const re = new RegExp(`<(${tagPattern})(\\s[^>]*)?>([^<]+)</\\1>`, 'gi');
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const text = m[3].trim();
    if (isSafeText(text)) found.add(text);
  }

  for (const attr of ['placeholder', 'title', 'aria-label']) {
    const attrRe = new RegExp(`${attr}="([^"]*[а-яА-ЯЁё][^"]*)"`, 'g');
    while ((m = attrRe.exec(tpl)) !== null) {
      if (isSafeText(m[1])) found.add(m[1]);
    }
  }

  // option ternary: {{ isLoading ? 'A' : 'B' }}
  const ternaryRe = /['"]([^'"]*[а-яА-ЯЁё][^'"]*)['"]/g;
  while ((m = ternaryRe.exec(tpl)) !== null) {
    if (isSafeText(m[1])) found.add(m[1]);
  }

  return [...found].sort((a, b) => b.length - a.length);
}

function toEnglish(ru) {
  if (EN_MAP[ru]) return EN_MAP[ru];
  return ru
    .replace(/Выберите/g, 'Select')
    .replace(/Загрузка/g, 'Loading')
    .replace(/адрес/g, 'address')
    .replace(/Почтовый индекс/g, 'Postal code')
    .replace(/Юридический/g, 'Legal')
    .replace(/Ошибка/g, 'Error');
}

function buildKeyMap(strings) {
  const map = {};
  const used = new Set();
  for (const text of strings) {
    let key = slugify(text);
    let i = 0;
    while (used.has(key)) {
      i += 1;
      key = `${slugify(text)}_${i}`;
    }
    used.add(key);
    map[text] = key;
  }
  return map;
}

function applyToTemplate(tpl, textToKey) {
  let result = tpl;
  const sorted = Object.entries(textToKey).sort((a, b) => b[0].length - a[0].length);

  for (const [text, key] of sorted) {
    const tk = `deploy.form.${key}`;
    if (result.includes(`'${tk}'`)) continue;

    const tagPattern = ALLOWED_TAGS.join('|');
    result = result.replace(
      new RegExp(`(<(?:${tagPattern})(?:\\s[^>]*)?>)\\s*${escapeRegExp(text)}\\s*(</(?:${tagPattern})>)`, 'gi'),
      `$1{{ $t('${tk}') }}$2`
    );

    for (const attr of ['placeholder', 'title', 'aria-label']) {
      result = result.replace(
        new RegExp(`${attr}="${escapeRegExp(text)}"`, 'g'),
        `:${attr}="$t('${tk}')"`
      );
    }

    result = result.replace(
      new RegExp(`'${escapeRegExp(text)}'`, 'g'),
      (match, offset, str) => {
        const before = str.slice(Math.max(0, offset - 30), offset);
        if (before.includes('$t(') || before.includes("t('")) return match;
        if (!before.includes('{{') && !before.includes('?')) return match;
        return `$t('${tk}')`;
      }
    );
  }
  return result;
}

const content = fs.readFileSync(VUE_FILE, 'utf8');
const template = extractTemplate(content);
const strings = extractStrings(template);
const textToKey = buildKeyMap(strings);

const deployRu = { form: {} };
const deployEn = { form: {} };
for (const [text, key] of Object.entries(textToKey)) {
  deployRu.form[key] = text;
  deployEn.form[key] = toEnglish(text);
}

fs.writeFileSync(path.join(LOCALES, 'deploy.ru.json'), JSON.stringify(deployRu, null, 2) + '\n');
fs.writeFileSync(path.join(LOCALES, 'deploy.en.json'), JSON.stringify(deployEn, null, 2) + '\n');

const newTemplate = applyToTemplate(template, textToKey);
let updated = content.replace(/<template>[\s\S]*?<\/template>/, `<template>${newTemplate}</template>`);

if (!updated.includes('useI18n')) {
  updated = updated.replace(
    /<script setup>\n/,
    `<script setup>\nimport { useI18n } from 'vue-i18n';\nconst { t } = useI18n();\n`
  );
}

fs.writeFileSync(VUE_FILE, updated, 'utf8');
console.log(`Safe deploy template i18n: ${strings.length} strings`);
