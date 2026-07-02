#!/usr/bin/env node
/**
 * Извлекает пользовательские строки с кириллицей из frontend/src
 * для генерации locales/ru.json и проверки покрытия.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');
const SKIP_DIRS = new Set(['locales', 'assets/styles']);
const SKIP_FILES = /\.(css|md)$/;
const CYRILLIC = /[а-яА-ЯЁё]/;

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(SRC, full);
    if (fs.statSync(full).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, files);
    } else if (/\.(vue|js)$/.test(name) && !SKIP_FILES.test(name)) {
      files.push(full);
    }
  }
  return files;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function extractFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(SRC, filePath).replace(/\\/g, '/');
  const prefix = rel.replace(/\.(vue|js)$/, '').replace(/[/\\]/g, '.');
  const found = new Set();

  // Template text nodes: >text<
  const templateText = content.matchAll(/>([^<{][^<]*?)<\//g);
  for (const m of templateText) {
    const t = m[1].trim();
    if (t && CYRILLIC.test(t) && !t.startsWith('{{') && t.length < 200) {
      found.add(t);
    }
  }

  // Attributes: title="", placeholder="", label=""
  for (const attr of ['title', 'placeholder', 'label', 'aria-label']) {
    const re = new RegExp(`${attr}=["']([^"']*[а-яА-ЯЁё][^"']*)["']`, 'g');
    for (const m of content.matchAll(re)) {
      found.add(m[1]);
    }
  }

  // JS strings '...' or "..."
  const jsStrings = content.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*?[а-яА-ЯЁё](?:\\.|(?!\1)[^\\])*?)\1/g);
  for (const m of jsStrings) {
    const t = m[2];
    if (t.length < 300 && !t.includes('Copyright') && !t.includes('info@hb3')) {
      found.add(t);
    }
  }

  const entries = {};
  let i = 0;
  for (const text of found) {
    const key = `${prefix}.${slugify(text) || 's'}_${i++}`;
    entries[key] = text;
  }
  return entries;
}

const all = {};
const files = walk(SRC);
for (const f of files) {
  Object.assign(all, extractFromFile(f));
}

const outPath = path.join(SRC, 'locales/ru.extracted.json');
fs.writeFileSync(outPath, JSON.stringify(all, null, 2), 'utf8');
console.log(`Extracted ${Object.keys(all).length} strings → ${outPath}`);
