#!/usr/bin/env node

/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RISKY = /GPL|AGPL|SSPL|LGPL|EUPL|MPL|WTFPL|UNKNOWN|UNLICENSED/i;

const NOTES_RU = {
  default: 'Соблюдать условия лицензии',
  lgpl: 'LGPL-3.0: см. раздел «Соответствие LGPL-3.0» ниже',
  eupl: 'Dual MIT/EUPL; при модификации — условия EUPL',
  mpl: 'File-level copyleft при изменении файлов библиотеки',
};

const NOTES_EN = {
  default: 'Comply with license terms',
  lgpl: 'LGPL-3.0: see “LGPL-3.0 Compliance” section below',
  eupl: 'Dual MIT/EUPL; if modified — EUPL terms apply',
  mpl: 'File-level copyleft if library files are modified',
};

function renderLgplCompliance(lang) {
  if (lang === 'en') {
    return `## LGPL-3.0 Compliance

The backend production dependency tree includes **web3-utils** (LGPL-3.0), pulled
transitively via **solidity-coverage** (Hardhat tooling). DLE does **not** import
\`web3-utils\` directly; Ethereum interaction uses **ethers** and **viem** (MIT).

**web3-utils in this distribution**

| Field | Value |
|-------|-------|
| Package | web3-utils@1.10.4 |
| License | GNU Lesser General Public License v3.0 (LGPL-3.0) |
| Upstream | https://github.com/ethereum/web3.js/tree/1.x/packages/web3-utils |
| In DLE | Unmodified npm package in \`backend/node_modules/web3-utils/\` |

**DLE obligations when distributing the backend** (LGPL-3.0 Sections 4–6):

1. Include this Third-Party Notices file with the distribution.
2. Preserve all copyright and license notices in \`web3-utils\` source files.
3. Provide the complete LGPL-3.0 license text (see links below).
4. If **web3-utils** is distributed as part of the backend, the recipient must be
   able to replace or re-link the library (standard Node.js \`node_modules\` layout
   satisfies this).
5. If **web3-utils** is **modified**, publish the corresponding source of the
   modified version under LGPL-3.0. **DLE ships the unmodified upstream package.**

**What LGPL-3.0 does not require**

- Open-sourcing DLE proprietary application code that merely uses \`web3-utils\`
  as a separate npm dependency without modification.
- Relicensing DLE under LGPL, provided the obligations above are met.

**Full license text**

- GNU LGPL v3.0: https://www.gnu.org/licenses/lgpl-3.0.html
- Copy in distribution: \`backend/node_modules/web3-utils/LICENSE\` (when backend
  dependencies are included)

`;
  }

  return `## Соответствие LGPL-3.0

В production-дереве зависимостей backend присутствует **web3-utils** (LGPL-3.0),
подключаемый транзитивно через **solidity-coverage** (инструментарий Hardhat).
DLE **не импортирует** \`web3-utils\` напрямую; для работы с Ethereum используются
**ethers** и **viem** (MIT).

**web3-utils в данном дистрибутиве**

| Поле | Значение |
|------|----------|
| Пакет | web3-utils@1.10.4 |
| Лицензия | GNU Lesser General Public License v3.0 (LGPL-3.0) |
| Upstream | https://github.com/ethereum/web3.js/tree/1.x/packages/web3-utils |
| В DLE | Немодифицированный npm-пакет в \`backend/node_modules/web3-utils/\` |

**Обязательства DLE при распространении backend** (LGPL-3.0, разделы 4–6):

1. Включать данный файл Third-Party Notices в состав дистрибутива.
2. Сохранять все copyright- и license-уведомления в исходных файлах \`web3-utils\`.
3. Предоставлять полный текст лицензии LGPL-3.0 (см. ссылки ниже).
4. Если **web3-utils** распространяется вместе с backend, получатель должен иметь
   возможность заменить или перелинковать библиотеку (стандартная структура
   Node.js \`node_modules\` этому соответствует).
5. При **модификации** **web3-utils** — опубликовать соответствующий исходный код
   изменённой версии под LGPL-3.0. **DLE поставляет немодифицированный upstream-пакет.**

**Чего LGPL-3.0 не требует**

- Раскрывать проприетарный код приложения DLE, который лишь использует
  \`web3-utils\` как отдельную npm-зависимость без модификации.
- Перелицензировать DLE под LGPL при соблюдении обязательств выше.

**Полный текст лицензии**

- GNU LGPL v3.0: https://www.gnu.org/licenses/lgpl-3.0.html
- Копия в дистрибутиве: \`backend/node_modules/web3-utils/LICENSE\` (при включении
  зависимостей backend)

`;
}

function noteFor(license, lang) {
  const notes = lang === 'en' ? NOTES_EN : NOTES_RU;
  if (/LGPL/i.test(license)) return notes.lgpl;
  if (/EUPL/i.test(license)) return notes.eupl;
  if (/MPL/i.test(license)) return notes.mpl;
  return notes.default;
}

function scanPackageDir(cwd, excludeName) {
  const json = execSync('npx --yes license-checker --production --json', {
    cwd,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const data = JSON.parse(json);
  return Object.entries(data)
    .filter(([name]) => name !== excludeName)
    .map(([name, info]) => ({
      name,
      licenses: info.licenses || 'UNKNOWN',
      repository: info.repository || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function groupByLicense(entries) {
  const groups = {};
  for (const entry of entries) {
    groups[entry.licenses] = (groups[entry.licenses] || 0) + 1;
  }
  return Object.entries(groups).sort((a, b) => b[1] - a[1]);
}

function renderSection(title, entries, lang) {
  const totalLabel = lang === 'en' ? 'Total packages' : 'Всего пакетов';
  const attentionLabel = lang === 'en' ? 'Requires attention' : 'Требуют внимания';
  const fullListLabel = lang === 'en' ? 'Full package list' : 'Полный список пакетов';
  const noteCol = lang === 'en' ? 'Note' : 'Примечание';
  const pkgCol = lang === 'en' ? 'Package' : 'Пакет';
  const licCol = lang === 'en' ? 'License' : 'Лицензия';
  const repoCol = lang === 'en' ? 'Repository' : 'Репозиторий';

  let md = `## ${title}\n\n`;
  md += `${totalLabel}: **${entries.length}**\n\n`;
  md += `| ${licCol} | ${lang === 'en' ? 'Count' : 'Количество'} |\n|----------|------------|\n`;
  for (const [lic, count] of groupByLicense(entries)) {
    md += `| ${lic.replace(/\|/g, '\\|')} | ${count} |\n`;
  }
  md += '\n';

  const attention = entries.filter((e) => RISKY.test(e.licenses));
  if (attention.length) {
    md += `### ${attentionLabel}\n\n`;
    md += `| ${pkgCol} | ${licCol} | ${noteCol} |\n|-------|----------|------------|\n`;
    for (const e of attention) {
      md += `| ${e.name} | ${e.licenses} | ${noteFor(e.licenses, lang)} |\n`;
    }
    md += '\n';
  }

  md += `<details>\n<summary>${fullListLabel}</summary>\n\n`;
  md += `| ${pkgCol} | ${licCol} | ${repoCol} |\n|-------|----------|-------------|\n`;
  for (const e of entries) {
    const repo = e.repository ? `[link](${e.repository})` : '—';
    md += `| ${e.name} | ${e.licenses.replace(/\|/g, '\\|')} | ${repo} |\n`;
  }
  md += '\n</details>\n\n';
  return md;
}

function buildDocument(lang, backend, frontend, date) {
  if (lang === 'en') {
    return `${`**English** | [Русский](../legal.ru/THIRD_PARTY_NOTICES.md)

# Third-Party Notices

**Project:** Digital Legal Entity (DLE)  
**Copyright (c) 2024-2026 Alexander Viktorovich Tarabanov**  
**Project license:** Proprietary — see [LICENSE](../LICENSE)

Generated from installed npm dependencies (\`license-checker --production\`).  
Generated: ${date}

## Obligations

When distributing DLE software:

1. Include this file with the distribution.
2. Do not remove copyright notices from third-party source code.
3. Comply with the license terms of packages listed below.
4. For Apache-2.0 — include NOTICE files where provided by the package.
5. For LGPL-3.0 (**web3-utils**) — follow the [LGPL-3.0 Compliance](#lgpl-30-compliance) section.

${renderLgplCompliance('en')}## Python: vector-search

| Package | License | Note |
|---------|---------|------|
| fastapi | MIT | https://github.com/fastapi/fastapi |
| uvicorn | BSD-3-Clause | https://github.com/encode/uvicorn |
| faiss-cpu | MIT | https://github.com/facebookresearch/faiss |
| requests | Apache-2.0 | https://github.com/psf/requests |
| pydantic | MIT | https://github.com/pydantic/pydantic |

---

${renderSection('Backend (Node.js, production)', backend, 'en')}---
${renderSection('Frontend (Node.js, production)', frontend, 'en')}---

## Common license texts

Full MIT, Apache-2.0, BSD, ISC, and LGPL texts are in \`node_modules/<package>/\` and at https://opensource.org/licenses and https://www.gnu.org/licenses/

### LGPL-3.0 (summary)

A weak copyleft library license. Permits use in proprietary applications when copyright
notices are preserved, the LGPL text is provided, and the library can be replaced by
the recipient. Modified versions of the library must be distributed under LGPL-3.0.
Full text: https://www.gnu.org/licenses/lgpl-3.0.html

**Licensing inquiries for DLE:** info@hb3-accelerator.com  
**Website:** https://hb3-accelerator.com
`}`;
  }

  return `${`[English](../legal.en/THIRD_PARTY_NOTICES.md) | **Русский**

# Уведомления о сторонних компонентах (Third-Party Notices)

**Проект:** Digital Legal Entity (DLE)  
**Copyright (c) 2024-2026 Тарабанов Александр Викторович**  
**Лицензия проекта:** Proprietary — см. [LICENSE](../LICENSE)

Документ составлен автоматически на основе установленных npm-зависимостей (\`license-checker --production\`).  
Дата генерации: ${date}

## Обязательства

При распространении ПО DLE необходимо:

1. Сохранять данный файл вместе с дистрибутивом.
2. Не удалять copyright-уведомления из исходного кода сторонних библиотек.
3. Соблюдать условия лицензий перечисленных ниже пакетов.
4. Для Apache-2.0 — включать соответствующие NOTICE-файлы (если поставляются пакетом).
5. Для LGPL-3.0 (**web3-utils**) — см. раздел [«Соответствие LGPL-3.0»](#соответствие-lgpl-30).

${renderLgplCompliance('ru')}## Python: vector-search

| Пакет | Лицензия | Примечание |
|-------|----------|------------|
| fastapi | MIT | https://github.com/fastapi/fastapi |
| uvicorn | BSD-3-Clause | https://github.com/encode/uvicorn |
| faiss-cpu | MIT | https://github.com/facebookresearch/faiss |
| requests | Apache-2.0 | https://github.com/psf/requests |
| pydantic | MIT | https://github.com/pydantic/pydantic |

## Python: runtime (backend Docker)

Системные пакеты устанавливаются через apt в Docker-образе backend (python3, curl и др.) — лицензии соответствуют дистрибутиву Debian.

---

${renderSection('Backend (Node.js, production)', backend, 'ru')}---
${renderSection('Frontend (Node.js, production)', frontend, 'ru')}---

## Тексты распространённых лицензий

Полные тексты MIT, Apache-2.0, BSD и ISC доступны в каталогах \`node_modules/<package>/\` каждого компонента
и на https://opensource.org/licenses

### MIT (кратко)

Разрешается использование, копирование, модификация, слияние, публикация, распространение, сублицензирование
и продажа копий при условии включения copyright-уведомления и текста лицензии во все копии или существенные части ПО.

### Apache-2.0 (кратко)

Разрешается использование при условии сохранения copyright, текста лицензии и файлов NOTICE;
предоставляется патентная лицензия; изменения должны быть помечены.

### LGPL-3.0 (кратко)

Слабая copyleft-лицензия для библиотек. Разрешает использование в проприетарных приложениях
при условии сохранения уведомлений, предоставления текста LGPL и возможности замены библиотеки.
Модифицированные версии библиотеки должны распространяться под LGPL-3.0.
Полный текст: https://www.gnu.org/licenses/lgpl-3.0.html

---

**Контакты по лицензированию DLE:** info@hb3-accelerator.com  
**Сайт:** https://hb3-accelerator.com
`}`;
}

function main() {
  const date = new Date().toISOString().slice(0, 10);
  const backend = scanPackageDir(path.join(ROOT, 'backend'), 'dapp-for-business-backend@1.0.0');
  const frontend = scanPackageDir(path.join(ROOT, 'frontend'), 'frontend@0.1.0');

  const ruPath = path.join(ROOT, 'legal.ru/THIRD_PARTY_NOTICES.md');
  const enPath = path.join(ROOT, 'legal.en/THIRD_PARTY_NOTICES.md');
  const backendPath = path.join(ROOT, 'backend/THIRD_PARTY_NOTICES.md');

  const ruDoc = buildDocument('ru', backend, frontend, date);
  const enDoc = buildDocument('en', backend, frontend, date);

  fs.writeFileSync(ruPath, ruDoc, 'utf8');
  fs.writeFileSync(enPath, enDoc, 'utf8');
  fs.writeFileSync(backendPath, ruDoc, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'frontend/public/THIRD_PARTY_NOTICES.md'), ruDoc, 'utf8');

  console.log(`Generated: ${ruPath}`);
  console.log(`Generated: ${enPath}`);
  console.log(`Generated: ${backendPath}`);
  console.log(`Backend packages: ${backend.length}, Frontend packages: ${frontend.length}`);
}

main();
