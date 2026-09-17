/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Skills агента медиатеки: маркетплейс (SKILL.md) + загрузка zip/SKILL.md.
 */

const fsp = require('fs/promises');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const BUNDLED_DIR = path.join(__dirname, '../data/media-agent-skills');
const USER_DIR = path.join(__dirname, '../uploads/media-agent/skills');

const CATEGORIES = [
  { id: 'all', labelKey: 'all' },
  { id: 'content', labelKey: 'content' },
  { id: 'visual', labelKey: 'visual' },
  { id: 'data', labelKey: 'data' },
  { id: 'research', labelKey: 'research' },
  { id: 'productivity', labelKey: 'productivity' },
];

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `skill-${crypto.randomUUID().slice(0, 8)}`;
}

function parseFrontmatter(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    return {
      name: '',
      description: '',
      title: '',
      author: '',
      category: 'productivity',
      body: raw.trim(),
      raw,
    };
  }
  const fm = {};
  const lines = m[1].replace(/\r/g, '').split('\n');
  let key = null;
  let acc = '';
  let folding = false;
  const flush = () => {
    if (!key) return;
    fm[key] = acc.trim();
    key = null;
    acc = '';
    folding = false;
  };
  for (const line of lines) {
    if (folding && (/^\s/.test(line) || line === '')) {
      acc += `${acc ? ' ' : ''}${line.trim()}`;
      continue;
    }
    if (folding) flush();
    const i = line.indexOf(':');
    if (i < 0) continue;
    key = line.slice(0, i).trim();
    const rest = line.slice(i + 1).trim();
    if (rest === '>' || rest === '|') {
      folding = true;
      acc = '';
    } else {
      acc = rest.replace(/^['"]|['"]$/g, '');
      folding = false;
      flush();
    }
  }
  flush();
  const name = slugify(fm.name);
  return {
    name,
    description: String(fm.description || '').slice(0, 1024),
    title: String(fm.title || fm.name || name),
    author: String(fm.author || 'Custom'),
    category: String(fm.category || 'productivity').toLowerCase(),
    body: m[2].trim(),
    raw,
  };
}

function extractSkillMdFromZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let offset = 0;
  while (offset + 30 <= buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const name = buf.slice(offset + 30, offset + 30 + nameLen).toString('utf8');
    const dataStart = offset + 30 + nameLen + extraLen;
    const data = buf.slice(dataStart, dataStart + compSize);
    const base = name.replace(/\\/g, '/').split('/').pop();
    if (/^skill\.md$/i.test(base || '')) {
      if (method === 0) return data.toString('utf8');
      if (method === 8) return zlib.inflateRawSync(data).toString('utf8');
      const err = new Error('ZIP: нужен STORE или DEFLATE для SKILL.md');
      err.status = 400;
      throw err;
    }
    offset = dataStart + compSize;
  }
  const err = new Error('В архиве нет SKILL.md');
  err.status = 400;
  err.code = 'SKILL_MD_MISSING';
  throw err;
}

function publicSkill(parsed, { id, source, installed }) {
  const initials = String(parsed.title || parsed.name || 'SK')
    .replace(/[^a-zA-Zа-яА-Я0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'SK';
  return {
    id,
    name: parsed.name,
    title: parsed.title || parsed.name,
    author: parsed.author,
    category: parsed.category,
    description: parsed.description,
    initials,
    source,
    installed: Boolean(installed),
  };
}

async function readSkillFile(filePath) {
  const text = await fsp.readFile(filePath, 'utf8');
  return parseFrontmatter(text);
}

async function listSkillDirs(root) {
  try {
    const names = await fsp.readdir(root, { withFileTypes: true });
    return names.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

async function loadFromRoot(root, source) {
  const ids = await listSkillDirs(root);
  const out = [];
  for (const id of ids) {
    const file = path.join(root, id, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = await readSkillFile(file);
      out.push({ id, parsed, file, source });
    } catch {
      /* skip broken */
    }
  }
  return out;
}

async function ensureUserDir() {
  await fsp.mkdir(USER_DIR, { recursive: true });
}

async function listSkills() {
  const bundled = await loadFromRoot(BUNDLED_DIR, 'marketplace');
  const mine = await loadFromRoot(USER_DIR, 'user');
  const installedIds = new Set(mine.map((s) => s.parsed.name || s.id));
  return {
    categories: CATEGORIES,
    marketplace: bundled.map((s) => publicSkill(s.parsed, {
      id: s.parsed.name || s.id,
      source: 'marketplace',
      installed: installedIds.has(s.parsed.name || s.id),
    })),
    mine: mine.map((s) => publicSkill(s.parsed, {
      id: s.id,
      source: 'user',
      installed: true,
    })),
  };
}

async function getSkillRecord(id) {
  const key = String(id || '').trim();
  if (!key) return null;
  const userFile = path.join(USER_DIR, key, 'SKILL.md');
  const bundledFile = path.join(BUNDLED_DIR, key, 'SKILL.md');
  const file = fs.existsSync(userFile) ? userFile : (fs.existsSync(bundledFile) ? bundledFile : null);
  if (!file) return null;
  const parsed = await readSkillFile(file);
  return { id: key, parsed, file };
}

async function getSkillPrompt(id) {
  const rec = await getSkillRecord(id);
  if (!rec) return '';
  const p = rec.parsed;
  return `Активный skill «${p.title || p.name}»: ${p.description}\n\n${p.body}`.slice(0, 8000);
}

async function installMarketplace(id) {
  const rec = await getSkillRecord(id);
  if (!rec || !rec.file.startsWith(BUNDLED_DIR)) {
    const bundled = path.join(BUNDLED_DIR, String(id || ''), 'SKILL.md');
    if (!fs.existsSync(bundled)) {
      const err = new Error('Skill не найден в маркетплейсе');
      err.status = 404;
      throw err;
    }
  }
  const src = path.join(BUNDLED_DIR, String(id || ''), 'SKILL.md');
  if (!fs.existsSync(src)) {
    const err = new Error('Skill не найден в маркетплейсе');
    err.status = 404;
    throw err;
  }
  await ensureUserDir();
  const destDir = path.join(USER_DIR, String(id));
  await fsp.mkdir(destDir, { recursive: true });
  await fsp.copyFile(src, path.join(destDir, 'SKILL.md'));
  return getSkillRecord(id);
}

async function saveSkillMarkdown(text, { preferredId } = {}) {
  const parsed = parseFrontmatter(text);
  if (!parsed.name || !parsed.description) {
    const err = new Error('В SKILL.md нужны name и description в YAML');
    err.status = 400;
    err.code = 'SKILL_YAML';
    throw err;
  }
  await ensureUserDir();
  const id = slugify(preferredId || parsed.name);
  const destDir = path.join(USER_DIR, id);
  await fsp.mkdir(destDir, { recursive: true });
  const header = [
    '---',
    `name: ${parsed.name}`,
    `description: ${parsed.description}`,
    `title: ${parsed.title || parsed.name}`,
    `author: ${parsed.author || 'Custom'}`,
    `category: ${parsed.category || 'productivity'}`,
    '---',
    '',
    parsed.body || '',
    '',
  ].join('\n');
  await fsp.writeFile(path.join(destDir, 'SKILL.md'), header, 'utf8');
  return getSkillRecord(id);
}

async function uploadSkillFile({ buffer, originalName, mime }) {
  const name = String(originalName || '').toLowerCase();
  let text = '';
  if (name.endsWith('.zip') || /zip/.test(mime || '')) {
    text = extractSkillMdFromZip(buffer);
  } else if (name.endsWith('.md') || /markdown|text/.test(mime || '')) {
    text = Buffer.from(buffer).toString('utf8');
  } else {
    const asText = Buffer.from(buffer).toString('utf8');
    if (asText.includes('---')) text = asText;
    else {
      const err = new Error('Нужен zip или SKILL.md');
      err.status = 400;
      throw err;
    }
  }
  return saveSkillMarkdown(text);
}

async function removeUserSkill(id) {
  const destDir = path.join(USER_DIR, String(id || ''));
  if (!destDir.startsWith(USER_DIR) || destDir === USER_DIR) {
    const err = new Error('Некорректный skill');
    err.status = 400;
    throw err;
  }
  await fsp.rm(destDir, { recursive: true, force: true });
}

module.exports = {
  CATEGORIES,
  listSkills,
  getSkillRecord,
  getSkillPrompt,
  installMarketplace,
  uploadSkillFile,
  removeUserSkill,
  publicSkill,
};
