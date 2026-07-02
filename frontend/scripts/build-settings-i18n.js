/**
 * One-off helper: generate settings locale keys from Vue files.
 * Run: node scripts/build-settings-i18n.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const files = [
  'src/views/SettingsView.vue',
  'src/views/settings/SettingsIndexView.vue',
  'src/views/settings/AiSettingsView.vue',
  'src/views/settings/SecuritySettingsView.vue',
  'src/views/settings/WebSshSettingsView.vue',
  'src/views/settings/RpcProvidersSettings.vue',
  'src/views/settings/AuthTokensSettings.vue',
  'src/views/settings/AIProviderSettings.vue',
  'src/views/settings/Interface/InterfaceSettingsView.vue',
  'src/views/settings/Interface/InterfaceWebSshView.vue',
  'src/views/settings/AI/EmailSettingsView.vue',
  'src/views/settings/AI/TelegramSettingsView.vue',
  'src/views/settings/AI/OllamaSettingsView.vue',
  'src/views/settings/AI/OpenAISettingsView.vue',
  'src/views/settings/AI/DatabaseSettingsView.vue',
  'src/views/settings/AI/AiAssistantSettings.vue',
  'src/views/settings/DleDeployFormView.vue',
];

function slugify(str) {
  return str
    .replace(/[^\w\u0400-\u04FF]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
    .replace(/[^\w]/g, '') || 'key';
}

function extractStrings(content) {
  const set = new Set();
  const skip = (s) =>
    !s ||
    s.includes('console.') ||
    s.startsWith('[') ||
    s.length > 300 ||
    /^https?:\/\//.test(s);

  for (const m of content.matchAll(/(?:alert|confirm)\(\s*`([^`]+)`/g)) {
    if (/[А-Яа-яЁё]/.test(m[1]) && !skip(m[1])) set.add(m[1].trim());
  }
  for (const m of content.matchAll(/(?:alert|confirm)\(\s*'([^']+)'/g)) {
    if (/[А-Яа-яЁё]/.test(m[1]) && !skip(m[1])) set.add(m[1].trim());
  }
  for (const m of content.matchAll(/(?:alert|confirm)\(\s*"([^"]+)"/g)) {
    if (/[А-Яа-яЁё]/.test(m[1]) && !skip(m[1])) set.add(m[1].trim());
  }
  for (const m of content.matchAll(/>([^<>{}\n]*[А-Яа-яЁё][^<>{}\n]*)</g)) {
    const s = m[1].replace(/\{\{.*?\}\}/g, '').trim();
    if (/[А-Яа-яЁё]/.test(s) && !skip(s) && s.length < 120) set.add(s);
  }
  for (const m of content.matchAll(/(?:title|placeholder|message|label)=["']([^"']*[А-Яа-яЁё][^"']*)["']/g)) {
    if (!skip(m[1])) set.add(m[1].trim());
  }
  for (const m of content.matchAll(/return\s+'([^']*[А-Яа-яЁё][^']*)'/g)) {
    if (!skip(m[1])) set.add(m[1].trim());
  }
  return [...set].sort();
}

const all = {};
for (const f of files) {
  const content = fs.readFileSync(path.join(root, f), 'utf8');
  const base = path.basename(f, '.vue').replace(/SettingsView|View|Settings/g, '');
  const strings = extractStrings(content);
  all[f] = strings;
  console.log(`${f}: ${strings.length} strings`);
}

fs.writeFileSync(path.join(root, 'scripts/settings-strings-extract.json'), JSON.stringify(all, null, 2));
console.log('Written scripts/settings-strings-extract.json');
