#!/usr/bin/env node
/**
 * Залить data-room/rag-test/v1/*.md в admin_pages_simple как [Corpus] {id}.
 * visibility=internal, status=published. Затем нужен rebuild rag_chunks.
 *
 *   node scripts/rag-test-ingest-pages.js
 *   node scripts/rag-test-ingest-pages.js --apply
 */

const fs = require('fs');
const path = require('path');

function detectRoot() {
  const envRoot = process.env.DLE_APP_ROOT;
  if (envRoot && fs.existsSync(path.join(envRoot, 'data-room'))) return envRoot;
  if (fs.existsSync('/host-project/data-room')) return '/host-project';
  return path.resolve(__dirname, '../..');
}

const ROOT = detectRoot();
const SRC = path.join(ROOT, 'data-room', 'rag-test', 'v1');

function parseFm(text) {
  if (!String(text).startsWith('---')) return { fm: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { fm: {}, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '');
  const fm = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      fm[m[1]] = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      fm[m[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { fm, body };
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
  return html.split('\n\n').map((p) => {
    const t = p.trim();
    if (!t) return '';
    if (t.match(/^<[hul]/) || t.match(/<\/[hul]/) || t.match(/^<pre>/) || t.match(/<\/pre>/) || t.match(/^<hr/)) {
      return t;
    }
    return `<p>${t}</p>`;
  }).join('\n\n');
}

function isFaqSplitPage(name) {
  const n = String(name || '');
  return /^faq\.md$/i.test(n) || /^faq-.+\.md$/i.test(n);
}

function listDocs() {
  if (!fs.existsSync(SRC)) throw new Error(`Нет корпуса ${SRC}`);
  return fs.readdirSync(SRC)
    .filter((n) => n.endsWith('.md') && !n.startsWith('_') && !isFaqSplitPage(n))
    .sort()
    .map((name) => {
      const abs = path.join(SRC, name);
      const raw = fs.readFileSync(abs, 'utf8');
      const { fm, body } = parseFm(raw);
      const id = String(fm.id || name.replace(/\.md$/i, '')).trim();
      const audience = Array.isArray(fm.audience)
        ? fm.audience
        : String(fm.audience || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      return {
        file: name,
        id,
        title: `[Corpus] ${id}`,
        audience,
        body,
        bytes: Buffer.byteLength(body)
      };
    });
}

async function apply(docs) {
  const db = require('../db');
  let inserted = 0;
  let updated = 0;
  for (const doc of docs) {
    const html = markdownToHtml(doc.body);
    const summary = `rag-test/v1 ${doc.file} · audience: ${doc.audience.join(', ') || '—'}`;
    const seo = {
      title: doc.title,
      description: summary,
      keywords: 'DLE, corpus, RAG, rag-test',
      corpus_manifest_id: doc.id,
      corpus_source: `rag-test/v1/${doc.file}`,
      corpus_audience: doc.audience
    };
    const existing = await db.getQuery()(
      'SELECT id FROM admin_pages_simple WHERE title = $1 LIMIT 1',
      [doc.title]
    );
    if (existing.rows.length) {
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
      updated += 1;
      console.log(`UPDATE ${existing.rows[0].id} ${doc.title}`);
    } else {
      const ins = await db.getQuery()(
        `INSERT INTO admin_pages_simple
           (author_address, title, summary, content, seo, status, visibility,
            required_permission, format, mime_type, storage_type)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, NULL, $7, $8, $9)
         RETURNING id`,
        [
          doc.title,
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
      inserted += 1;
      console.log(`INSERT ${ins.rows[0].id} ${doc.title}`);
    }
  }
  return { inserted, updated, total: docs.length };
}

async function main() {
  const applyFlag = process.argv.includes('--apply');
  const docs = listDocs();
  console.log(`=== rag-test-ingest-pages ${applyFlag ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`source: ${SRC}`);
  console.log(`files: ${docs.length}`);
  for (const d of docs) {
    console.log(`  ${d.title}  (${d.file}, ${d.bytes}b, audience=${d.audience.join('|') || '—'})`);
  }
  if (!applyFlag) {
    console.log('\nDry-run. --apply пишет в admin_pages_simple.');
    return;
  }
  const result = await apply(docs);
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { listDocs, apply };
