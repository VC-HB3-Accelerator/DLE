#!/usr/bin/env node
/**
 * Заменяет точные русские строки из locale-файлов на $t('key') / t('key') в .vue и .js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');
const LOCALES_DIR = path.join(SRC, 'locales');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, fullKey, out);
    } else if (typeof v === 'string' && v.trim()) {
      out[fullKey] = v;
    }
  }
  return out;
}

function loadMessages() {
  const ru = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'ru.json'), 'utf8'));
  const settingsRu = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'settings.ru.json'), 'utf8'));
  if (fs.existsSync(path.join(LOCALES_DIR, 'deploy.ru.json'))) {
    const deployRu = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'deploy.ru.json'), 'utf8'));
    ru.deploy = deployRu;
  }
  ru.settings = { ...(ru.settings || {}), ...settingsRu };
  return flatten(ru);
}

function buildReverseMap(flat) {
  const map = new Map();
  const priority = (key) => {
    if (key.startsWith('common.')) return 0;
    if (key.startsWith('settings.')) return 1;
    if (key.startsWith('nav.')) return 2;
    return 3;
  };
  const entries = Object.entries(flat).sort((a, b) => priority(a[0]) - priority(b[0]) || a[0].length - b[0].length);
  for (const [key, value] of entries) {
    if (value.length < 2) continue;
    if (!/[а-яА-ЯЁё]/.test(value)) continue;
    if (!map.has(value)) map.set(value, key);
  }
  return map;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyToContent(content, reverseMap, stats) {
  let result = content;
  const sorted = [...reverseMap.entries()].sort((a, b) => b[0].length - a[0].length);

  for (const [text, key] of sorted) {
    if (result.includes(`$t('${key}')`) || result.includes(`t('${key}')`)) continue;

    // Template text nodes: >text<
    const tplRe = new RegExp(`>(\\s*)${escapeRegExp(text)}(\\s*)<`, 'g');
    if (tplRe.test(result)) {
      result = result.replace(new RegExp(`>(\\s*)${escapeRegExp(text)}(\\s*)<`, 'g'), `>$1{{ $t('${key}') }}$2<`);
      stats.replacements += 1;
    }

    // Attributes: title="text", placeholder="text", label="text"
    for (const attr of ['title', 'placeholder', 'label', 'aria-label']) {
      const attrRe = new RegExp(`${attr}="${escapeRegExp(text)}"`, 'g');
      if (attrRe.test(result)) {
        result = result.replace(attrRe, `:${attr}="$t('${key}')"`);
        stats.replacements += 1;
      }
      const attrReSingle = new RegExp(`${attr}='${escapeRegExp(text)}'`, 'g');
      if (attrReSingle.test(result)) {
        result = result.replace(attrReSingle, `:${attr}="$t('${key}')"`);
        stats.replacements += 1;
      }
    }

    // Script: use t() directly, never template literal '${t(...)}'
    result = result.replace(
      new RegExp(`(showSuccessMessage|showErrorMessage|alert|confirm)\\(['"]\\$\\{t\\('([^']+)'\\)\\}['"]`, 'g'),
      (_, fn, key) => `${fn}(t('${key}')`
    );
    result = result.replace(
      new RegExp(`(showSuccessMessage|showErrorMessage|alert|confirm)\\(['"]${escapeRegExp(text)}['"]`, 'g'),
      `$1(t('${key}')`
    );
  }
  return result;
}

const SKIP_FILES = new Set([
  'DleDeployFormView.vue',
  'LocaleControls.vue',
]);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === 'locales') continue;
    if (fs.statSync(full).isDirectory()) {
      if (name === 'assets') continue;
      walk(full, files);
    } else if (/\.vue$/.test(name) && !SKIP_FILES.has(name)) {
      files.push(full);
    }
  }
  return files;
}

function ensureUseI18n(content) {
  if (!content.includes('$t(') && !content.includes("t('")) return content;
  if (content.includes('useI18n')) return content;
  if (!content.includes('<script setup>')) return content;

  return content.replace(
    /<script setup>\n/,
    `<script setup>\nimport { useI18n } from 'vue-i18n';\nconst { t } = useI18n();\n`
  );
}

const flat = loadMessages();
const reverseMap = buildReverseMap(flat);
const files = walk(SRC);
let totalReplacements = 0;
let filesChanged = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  const stats = { replacements: 0 };
  let updated = applyToContent(original, reverseMap, stats);
  updated = ensureUseI18n(updated);
  if (updated !== original) {
    fs.writeFileSync(file, updated, 'utf8');
    filesChanged += 1;
    totalReplacements += stats.replacements;
  }
}

console.log(`Updated ${filesChanged} files, ~${totalReplacements} replacements, ${reverseMap.size} locale strings indexed`);
