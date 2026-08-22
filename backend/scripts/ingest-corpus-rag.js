/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Ingest корпуса Public_Data_Room → pages (+ опционально FAQ).
 * SoT: data-room/TZ-CORPUS-RAG-AGENTS.ru.md §8
 *
 * По умолчанию — dry-run (без записи в БД).
 * Без автодеплоя на VDS. --apply только локально / в Docker compose по команде.
 *
 * Usage:
 *   node backend/scripts/ingest-corpus-rag.js
 *   node backend/scripts/ingest-corpus-rag.js --dry-run --audience public-client
 *   node backend/scripts/ingest-corpus-rag.js --target pages --apply
 *   node backend/scripts/ingest-corpus-rag.js --faq-seed --apply
 *   node backend/scripts/ingest-corpus-rag.js --faq-seed --dry-run
 *
 * Таблица FAQ — по имени «FAQ» (RAG=Да), не по числу id.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function detectRoot() {
  const envRoot = process.env.DLE_APP_ROOT;
  if (envRoot && fs.existsSync(path.join(envRoot, 'data-room'))) return envRoot;
  if (fs.existsSync('/host-project/data-room')) return '/host-project';
  return path.resolve(__dirname, '..', '..');
}

const ROOT = detectRoot();
const MANIFEST_PATH = path.join(ROOT, 'data-room', 'Public_Data_Room', '_meta', 'manifest.json');
const FAQ_SEED_PATH = path.join(ROOT, 'data-room', 'rag-test', 'B1-FAQ-SEED.ru.md');

function parseArgs(argv) {
  const args = {
    dryRun: true,
    apply: false,
    target: 'both', // pages | faq | both
    audience: null,
    audiences: [],
    packs: [],
    faqTableId: null,
    faqSeed: false,
    help: false
  };
  let targetSet = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') { args.dryRun = true; args.apply = false; }
    else if (a === '--apply') { args.apply = true; args.dryRun = false; }
    else if (a === '--faq-seed') args.faqSeed = true;
    else if (a === '--target' && argv[i + 1]) {
      args.target = argv[++i];
      targetSet = true;
    }
    else if (a === '--audience' && argv[i + 1]) args.audiences.push(argv[++i]);
    else if (a === '--pack' && argv[i + 1]) args.packs.push(argv[++i]);
    else if (a === '--faq-table-id' && argv[i + 1]) args.faqTableId = Number(argv[++i]);
  }
  if (args.faqSeed && !targetSet) args.target = 'faq';
  args.audience = args.audiences[0] || null;
  if (!['pages', 'faq', 'both'].includes(args.target)) {
    throw new Error(`Invalid --target ${args.target}; use pages|faq|both`);
  }
  return args;
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found: ${MANIFEST_PATH}`);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

function emptyManifest() {
  return { version: 'faq-seed', updated: '-', documents: [] };
}

function loadManifestIfPresent() {
  if (!fs.existsSync(MANIFEST_PATH)) return emptyManifest();
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

async function resolveFaqTableId(explicitId) {
  if (explicitId) return Number(explicitId);
  const encryptedDb = require('../services/encryptedDatabaseService');
  const tables = await encryptedDb.getData('user_tables', {});
  const hit = (tables || []).find((t) => {
    const n = String(t.name || '').trim().toLowerCase();
    const rag = Number(t.is_rag_source_id || t.is_rag_source) === 1;
    return rag && n === 'faq';
  });
  if (!hit) {
    throw new Error(
      'Таблица «FAQ» (RAG=Да) не найдена по имени. Передайте --faq-table-id или заведите таблицу FAQ.'
    );
  }
  console.log(`FAQ table resolved by name: id=${hit.id}`);
  return hit.id;
}

function filterDocs(manifest, { audience, audiences, packs } = {}) {
  const aud = [...(audiences || [])];
  if (audience && !aud.includes(audience)) aud.push(audience);
  const packList = (packs || []).map((p) => String(p).replace(/\/+$/, '')).filter(Boolean);
  return (manifest.documents || []).filter((doc) => {
    if (doc.status !== 'approved') return false;
    const targets = doc.rag_targets || [];
    if (!targets.length) return false;
    if (aud.length) {
      const docAud = doc.audience || [];
      if (!aud.some((a) => docAud.includes(a))) return false;
    }
    if (packList.length) {
      const p = String(doc.path || '');
      const ok = packList.some((pack) => p === pack || p.startsWith(`${pack}/`));
      if (!ok) return false;
    }
    return true;
  });
}

function pageTitle(doc) {
  return `[Corpus] ${doc.id}`;
}

function markdownToHtml(markdown) {
  let html = markdown;
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n)+/g, '<ul>$&</ul>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---$/gim, '<hr>');
  html = html.split('\n\n').map((p) => {
    p = p.trim();
    if (
      p &&
      !p.match(/^<[hul]/) &&
      !p.match(/<\/[hul]/) &&
      !p.match(/^<pre>/) &&
      !p.match(/<\/pre>/)
    ) {
      return `<p>${p}</p>`;
    }
    return p;
  }).join('\n\n');
  return html;
}

function checksum(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function resolveDocPath(relPath) {
  return path.join(ROOT, 'data-room', 'Public_Data_Room', relPath);
}

const FAQ_AUDIENCE_SLUGS = new Set(['public-client', 'partner', 'investor-a']);
const FAQ_MODE_SLUGS = new Set(['sales', 'support', 'dle-setup']);

/**
 * Заголовок секции B1: `## public-client`, `## support`, `## support+partner`, `## public-client+dle-setup`.
 * Неизвестные секции (regulator-pilot, investor-b, Negative) пропускаются.
 */
function parseFaqSectionHeading(line) {
  const h = String(line || '').match(/^##\s+([a-z0-9+_.-]+)/i);
  if (!h) return null;
  const raw = h[1].toLowerCase();
  if (raw.startsWith('negative') || raw.startsWith('assistant')) return { skip: true };
  const parts = raw.split('+').map((s) => s.trim()).filter(Boolean);
  let audience = '';
  let service_mode = '';
  let known = false;
  for (const part of parts) {
    if (FAQ_AUDIENCE_SLUGS.has(part)) {
      audience = part;
      known = true;
    } else if (FAQ_MODE_SLUGS.has(part)) {
      service_mode = part;
      known = true;
    }
  }
  if (!known) return { skip: true };
  return { audience, service_mode };
}

/**
 * Парсит Q/A таблицы из B1-FAQ-SEED.ru.md.
 * Секции задают ЦА и/или слой: public-client / partner / investor-a / support / dle-setup и комбо через `+`.
 */
function parseFaqSeed(md) {
  const rows = [];
  let section = null;
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      const parsed = parseFaqSectionHeading(lines[i]);
      section = parsed && !parsed.skip ? parsed : null;
      continue;
    }
    if (!section) continue;
    // | question | answer | claim_level | source_id |
    const m = lines[i].match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const question = m[1].trim();
    const answer = m[2].trim();
    const claimLevel = m[3].trim();
    const sourceId = m[4].trim();
    if (!question || question === 'question' || question.startsWith('---')) continue;
    if (question.includes('---') || answer === 'answer') continue;
    rows.push({
      audience: section.audience || '',
      service_mode: section.service_mode || '',
      question,
      answer,
      claim_level: claimLevel,
      source_id: sourceId
    });
  }
  return rows;
}

function planPages(docs) {
  const plan = [];
  for (const doc of docs) {
    const targets = doc.rag_targets || [];
    if (!targets.includes('pages')) continue;
    const filePath = resolveDocPath(doc.path);
    const exists = fs.existsSync(filePath);
    const md = exists ? fs.readFileSync(filePath, 'utf8') : null;
    plan.push({
      kind: 'page',
      id: doc.id,
      path: doc.path,
      audience: doc.audience,
      title: pageTitle(doc),
      exists,
      checksum: md ? checksum(md) : null,
      bytes: md ? Buffer.byteLength(md) : 0
    });
  }
  return plan;
}

function planFaqFromManifest(docs) {
  return docs
    .filter((d) => (d.rag_targets || []).includes('faq_table'))
    .map((d) => ({
      kind: 'faq_source_doc',
      id: d.id,
      path: d.path,
      note: 'FAQ rows come from B1-FAQ-SEED (Canon), not raw MD dump'
    }));
}

async function applyPages(plan) {
  const db = require('../db');
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of plan) {
    if (!item.exists) {
      console.warn(`SKIP missing file: ${item.path}`);
      skipped += 1;
      continue;
    }
    const md = fs.readFileSync(resolveDocPath(item.path), 'utf8');
    const html = markdownToHtml(md);
    const summary = `Corpus ${item.id} · audiences: ${(item.audience || []).join(', ')} · sha ${item.checksum}`;
    const seo = {
      title: item.title,
      description: summary,
      keywords: 'DLE, corpus, RAG',
      corpus_manifest_id: item.id,
      corpus_checksum: item.checksum,
      corpus_audience: Array.isArray(item.audience) ? item.audience : []
    };

    const existing = await db.getQuery()(
      `SELECT id FROM admin_pages_simple WHERE title = $1 LIMIT 1`,
      [item.title]
    );

    if (existing.rows.length > 0) {
      await db.getQuery()(
        `UPDATE admin_pages_simple
         SET summary = $2, content = $3, seo = $4, status = $5, visibility = $6,
             format = $7, mime_type = $8, storage_type = $9, updated_at = NOW()
         WHERE id = $1`,
        [
          existing.rows[0].id,
          summary,
          html,
          JSON.stringify(seo),
          'published',
          'internal',
          'html',
          'text/html',
          'embedded'
        ]
      );
      console.log(`UPDATE page id=${existing.rows[0].id} ${item.title}`);
      updated += 1;
    } else {
      const ins = await db.getQuery()(
        `INSERT INTO admin_pages_simple
          (author_address, title, summary, content, seo, status, visibility, required_permission, format, mime_type, storage_type)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9)
         RETURNING id`,
        [
          item.title,
          summary,
          html,
          JSON.stringify(seo),
          'published',
          'internal',
          'html',
          'text/html',
          'embedded'
        ]
      );
      console.log(`INSERT page id=${ins.rows[0].id} ${item.title}`);
      inserted += 1;
    }
  }

  return { inserted, updated, skipped };
}

function getEncryptionKey() {
  const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8').trim();
  }
  return process.env.DB_ENCRYPTION_KEY || 'default-key';
}

async function resolveFaqColumns(db, tableId, encryptionKey) {
  const cols = await db.getQuery()(
    `SELECT id, decrypt_text(name_encrypted, $1) AS name, options
     FROM user_columns WHERE table_id = $2 ORDER BY id`,
    [encryptionKey, tableId]
  );
  const byPurpose = {};
  for (const col of cols.rows) {
    const purpose = col.options?.purpose;
    if (purpose) byPurpose[purpose] = col.id;
  }
  if (!byPurpose.question || !byPurpose.answer) {
    throw new Error(
      `FAQ table ${tableId}: need columns with options.purpose=question and answer. Found: ${JSON.stringify(byPurpose)}`
    );
  }
  return byPurpose;
}

async function findFaqRowByQuestion(db, tableId, questionColId, question, encryptionKey) {
  const res = await db.getQuery()(
    `SELECT r.id AS row_id
     FROM user_rows r
     JOIN user_cell_values c ON c.row_id = r.id AND c.column_id = $2
     WHERE r.table_id = $1
       AND decrypt_text(c.value_encrypted, $3) = $4
     LIMIT 1`,
    [tableId, questionColId, encryptionKey, question]
  );
  return res.rows[0]?.row_id || null;
}

async function upsertFaqCell(db, rowId, columnId, value, encryptionKey) {
  await db.getQuery()(
    `INSERT INTO user_cell_values (row_id, column_id, value_encrypted)
     VALUES ($1, $2, encrypt_text($3, $4))
     ON CONFLICT (row_id, column_id)
     DO UPDATE SET value_encrypted = encrypt_text($3, $4), updated_at = NOW()`,
    [rowId, columnId, value, encryptionKey]
  );
}

async function applyFaq(seedRows, tableId) {
  const db = require('../db');
  const encryptionKey = getEncryptionKey();
  const cols = await resolveFaqColumns(db, tableId, encryptionKey);

  let inserted = 0;
  let updated = 0;

  for (const row of seedRows) {
    const context = [
      `audience=${row.audience || ''}`,
      `service_mode=${row.service_mode || ''}`,
      `claim_level=${row.claim_level}`,
      `source_id=${row.source_id}`
    ].join('; ');

    let rowId = await findFaqRowByQuestion(db, tableId, cols.question, row.question, encryptionKey);
    if (!rowId) {
      const created = await db.getQuery()(
        `INSERT INTO user_rows (table_id) VALUES ($1) RETURNING id`,
        [tableId]
      );
      rowId = created.rows[0].id;
      inserted += 1;
      console.log(`INSERT faq row ${rowId}: ${row.question.slice(0, 60)}`);
    } else {
      updated += 1;
      console.log(`UPDATE faq row ${rowId}: ${row.question.slice(0, 60)}`);
    }

    await upsertFaqCell(db, rowId, cols.question, row.question, encryptionKey);
    await upsertFaqCell(db, rowId, cols.answer, row.answer, encryptionKey);
    if (cols.context) {
      await upsertFaqCell(db, rowId, cols.context, context, encryptionKey);
    }
    if (cols.userTags || cols.audienceTags) {
      await upsertFaqCell(db, rowId, cols.userTags || cols.audienceTags, row.audience || '', encryptionKey);
    }
    if (cols.serviceMode) {
      await upsertFaqCell(db, rowId, cols.serviceMode, row.service_mode || '', encryptionKey);
    }
  }

  console.log('\nRemember: rebuild pgvector (rag_chunks) for the FAQ table. Not FAISS.');
  return { inserted, updated };
}

function printHelp() {
  console.log(`ingest-corpus-rag.js — корпус → pages / FAQ (ТЗ §8)

  Default: --dry-run (no DB writes)
  --apply              write to DB (local/compose only; no VDS auto-deploy)
  --target pages|faq|both
  --audience <name>    repeatable; filter manifest audience / FAQ seed
  --pack <folder>      repeatable; path prefix (public-client, partner, investor-a, company)
  --faq-table-id <id>  optional for faq --apply; иначе таблица по имени «FAQ»
  --faq-seed           plan/apply from data-room/rag-test/B1-FAQ-SEED.ru.md
                       (без --target сам ставит target=faq; манифест страниц не нужен)

Examples:
  node backend/scripts/ingest-corpus-rag.js --dry-run
  node backend/scripts/ingest-corpus-rag.js --target pages --apply
  node backend/scripts/ingest-corpus-rag.js --pack public-client --pack partner --target pages --apply
  node backend/scripts/ingest-corpus-rag.js --faq-seed --dry-run
  node backend/scripts/ingest-corpus-rag.js --faq-seed --apply
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const needPages = args.target === 'pages' || args.target === 'both';
  const manifest = needPages ? loadManifest() : loadManifestIfPresent();
  const docs = filterDocs(manifest, { audiences: args.audiences, packs: args.packs });
  const mode = args.apply ? 'APPLY' : 'DRY-RUN';

  console.log(`=== ingest-corpus-rag ${mode} ===`);
  console.log(`manifest: ${manifest.version} (${manifest.updated})`);
  console.log(`approved docs with rag_targets: ${docs.length}`);
  console.log(`target: ${args.target}`);

  const pagePlan = planPages(docs);
  const faqDocPlan = planFaqFromManifest(docs);
  let faqSeedRows = [];
  if (args.faqSeed || args.target === 'faq' || args.target === 'both') {
    if (fs.existsSync(FAQ_SEED_PATH)) {
      faqSeedRows = parseFaqSeed(fs.readFileSync(FAQ_SEED_PATH, 'utf8'));
      if (args.audiences.length) {
        faqSeedRows = faqSeedRows.filter((r) =>
          args.audiences.includes(r.audience) || args.audiences.includes(r.service_mode)
        );
      }
    }
  }

  if (args.target === 'pages' || args.target === 'both') {
    console.log('\n--- pages plan ---');
    for (const p of pagePlan) {
      console.log(
        `${p.exists ? 'OK' : 'MISS'} ${p.id} → "${p.title}" (${p.path}) sha=${p.checksum || '-'}`
      );
    }
  }

  if (args.target === 'faq' || args.target === 'both') {
    console.log('\n--- faq sources (manifest) ---');
    for (const f of faqDocPlan) {
      console.log(`DOC ${f.id} (${f.path}) — ${f.note}`);
    }
    console.log(`\n--- faq seed rows (B1-FAQ-SEED): ${faqSeedRows.length} ---`);
    for (const r of faqSeedRows.slice(0, 8)) {
      console.log(`  [${r.audience || '∅'}${r.service_mode ? '/' + r.service_mode : ''}] ${r.question.slice(0, 70)}`);
    }
    if (faqSeedRows.length > 8) console.log(`  … +${faqSeedRows.length - 8} more`);
  }

  if (!args.apply) {
    console.log('\nDry-run only. Re-run with --apply to write (local/compose).');
    console.log('After FAQ apply: rebuild pgvector (rag_chunks). Do not sync to VDS without explicit «можно».');
    return;
  }

  const results = {};
  if (args.target === 'pages' || args.target === 'both') {
    results.pages = await applyPages(pagePlan);
  }
  if (args.target === 'faq' || args.target === 'both') {
    if (!faqSeedRows.length) {
      throw new Error('No FAQ seed rows; check B1-FAQ-SEED.ru.md or --audience filter');
    }
    const tableId = await resolveFaqTableId(args.faqTableId);
    results.faq = await applyFaq(faqSeedRows, tableId);
  }

  console.log('\n=== done ===');
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  loadManifest,
  filterDocs,
  parseFaqSeed,
  parseFaqSectionHeading,
  planPages,
  pageTitle,
  detectRoot,
  resolveFaqTableId
};
