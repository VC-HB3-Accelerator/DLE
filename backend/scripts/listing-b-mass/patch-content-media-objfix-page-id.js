'use strict';

/** page_id в content_media может быть NULL — objfix снимаем по {id}-b-{file} из file_name. */
const fs = require('fs');
const p = '/app/services/contentMediaStore.js';
let s = fs.readFileSync(p, 'utf8');

const oldBlock = `  if (row.page_id != null && Number(row.page_id) !== pageId) {
    return { objfixRemoved: false, reason: 'page_id_mismatch' };
  }`;

const newBlock = `  if (row.page_id != null && Number(row.page_id) !== pageId) {
    /* file_name {pageId}-b-* — источник истины для каталога objfix */
  }`;

if (!s.includes(oldBlock)) {
  if (s.includes('page_id_mismatch')) {
    console.log(JSON.stringify({ ok: true, skipped: 'already_patched' }));
    process.exit(0);
  }
  console.error(JSON.stringify({ ok: false, error: 'block_not_found' }));
  process.exit(1);
}

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(p, s);
console.log(JSON.stringify({ ok: true, patched: 'objfix_page_id_from_file_name' }));
