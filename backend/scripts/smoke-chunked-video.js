/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Локальный smoke §4: 52 MiB video/webm чанками + resume (без HTTP/auth).
 * Запуск: docker exec -w /app dapp-backend node scripts/smoke-chunked-video.js
 */

const fs = require('fs');
const path = require('path');
const store = require('../services/contentMediaStore');
const limits = require('../shared/contentMediaLimits');

const SIZE = 52 * 1024 * 1024;
const PART = limits.PART_SIZE;
const TOTAL = Math.ceil(SIZE / PART);

function partSlice(n) {
  const start = (n - 1) * PART;
  const end = Math.min(start + PART, SIZE);
  const len = end - start;
  const buf = Buffer.alloc(len);
  for (let i = 0; i < len; i += 4096) {
    buf.writeUInt32BE((n * 1000003 + i) >>> 0, Math.min(i, len - 4));
  }
  return buf;
}

(async () => {
  console.log('PART_SIZE', PART, 'TOTAL_PARTS', TOTAL, 'SIZE', SIZE);
  console.log('shouldUseChunked', limits.shouldUseChunked('video', SIZE));

  const init = await store.initChunkedUpload({
    fileName: 'smoke-52m.webm',
    mimeType: 'video/webm',
    size: SIZE,
    authorAddress: '0xsmoke-chunk',
    pageId: null,
  });
  console.log('INIT', JSON.stringify(init));
  const uploadId = init.uploadId;

  for (let n = 1; n <= 3; n += 1) {
    const body = partSlice(n);
    const r = await store.putPart({ uploadId, partNumber: n, body });
    console.log('PART', n, 'size', r.size);
  }

  let st = await store.getUploadStatus(uploadId);
  console.log('STATUS_AFTER_3', JSON.stringify(st));
  if (st.received.length !== 3) {
    throw new Error(`expected 3 received, got ${st.received.length}`);
  }

  const have = new Set(st.received);
  const missing = [];
  for (let n = 1; n <= TOTAL; n += 1) {
    if (!have.has(n)) missing.push(n);
  }
  console.log('RESUME_MISSING', missing.join(','));

  for (const n of missing) {
    const body = partSlice(n);
    await store.putPart({ uploadId, partNumber: n, body });
    console.log('PART', n, 'ok');
  }

  st = await store.getUploadStatus(uploadId);
  console.log('STATUS_FULL', st.received.length, '/', st.totalParts, 'bytes', st.bytesReceived);
  if (st.received.length !== TOTAL || Number(st.bytesReceived) !== SIZE) {
    throw new Error('incomplete after resume');
  }

  const completed = await store.completeUpload(uploadId);
  const row = completed.row || completed;
  const resp = store.uploadResponse(row);
  console.log('COMPLETE', JSON.stringify({
    id: row.id,
    status: row.status,
    storage: row.storage,
    public_id: row.public_id,
    file_path: row.file_path,
    file_size: row.file_size,
    isDuplicate: Boolean(completed.isDuplicate),
    url: resp.url,
  }));

  if (!row.file_path) throw new Error('no file_path after complete');
  const abs = path.join('/app', row.file_path);
  const diskSize = fs.statSync(abs).size;
  console.log('DISK_SIZE', diskSize, 'MATCH', diskSize === SIZE);

  const list = await store.listMedia({ scope: 'cms', mediaType: 'video', limit: 5, offset: 0 });
  const found = list.data.find((x) => Number(x.id) === Number(row.id));
  console.log('LIST_FOUND', Boolean(found), found && found.url);
  console.log('PUBLIC_URL', resp.url);

  const ok = diskSize === SIZE && found && row.status === 'ready' && resp.url;
  console.log('SMOKE_CHUNKED_OK', Boolean(ok));
  if (!ok) process.exit(1);
  process.exit(0);
})().catch((e) => {
  console.error('FAIL', e.message || e);
  process.exit(1);
});
