/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * One-shot POST или чанки init/part/complete. Один helper для редактора и медиатеки.
 */

import api from '../api/axios';
import {
  PART_SIZE,
  MAX_PARALLEL_PARTS,
  classifyMime,
  maxBytesForKind,
  shouldUseChunked,
} from '@/shared/contentMediaLimits';

function kindFromFile(file) {
  const fromMime = classifyMime(file.type);
  if (fromMime) return fromMime;
  const name = String(file.name || '').toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(name)) return 'video';
  if (/\.(mp3|mpeg|wav|ogg|m4a|aac)$/i.test(name)) return 'audio';
  return null;
}

function storageKey(file) {
  return `cms-media-upload:${file.name}:${file.size}:${file.lastModified}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function oneShot(file, pageId) {
  const formData = new FormData();
  formData.append('media', file);
  if (pageId) formData.append('page_id', String(pageId));
  const response = await api.post('/uploads/media', formData);
  return response.data && response.data.data;
}

async function putPartWithRetry({ uploadId, partNumber, blob, signal }) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (signal && signal.aborted) throw lastErr || new Error('aborted');
    try {
      const res = await api.put(
        `/uploads/media/${uploadId}/parts/${partNumber}`,
        blob,
        {
          headers: { 'Content-Type': 'application/octet-stream' },
          signal,
          timeout: 10 * 60 * 1000,
        }
      );
      return res.data;
    } catch (err) {
      lastErr = err;
      const status = err.response && err.response.status;
      const network = !err.response;
      if (status && status < 500 && status !== 409) throw err;
      if (!network && status < 500) throw err;
      await sleep(1000 * (2 ** attempt));
    }
  }
  throw lastErr;
}

async function loadStatus(uploadId) {
  const res = await api.get(`/uploads/media/${uploadId}/status`);
  return res.data && res.data.data;
}

/**
 * @param {File} file
 * @param {{ pageId?: number, onProgress?: Function, signal?: AbortSignal }} [opts]
 */
export async function uploadContentMedia(file, { pageId, onProgress, signal } = {}) {
  const kind = kindFromFile(file);
  if (!kind) {
    const err = new Error('unsupported');
    err.code = 'UNSUPPORTED_TYPE';
    throw err;
  }
  if (file.size > maxBytesForKind(kind)) {
    const err = new Error('too large');
    err.code = 'MEDIA_TOO_LARGE';
    throw err;
  }

  if (!shouldUseChunked(kind, file.size)) {
    if (onProgress) onProgress({ percent: 5, phase: 'oneshot' });
    const data = await oneShot(file, pageId);
    if (onProgress) onProgress({ percent: 100, phase: 'done' });
    return data;
  }

  const key = storageKey(file);
  let uploadId = null;
  let totalParts = Math.ceil(file.size / PART_SIZE);
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.uploadId) uploadId = parsed.uploadId;
    }
  } catch {
    /* ignore */
  }

  let received = [];
  if (uploadId) {
    try {
      const st = await loadStatus(uploadId);
      received = Array.isArray(st.received) ? st.received : [];
      totalParts = st.totalParts || totalParts;
    } catch {
      uploadId = null;
      received = [];
      try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    }
  }

  if (!uploadId) {
    const initRes = await api.post('/uploads/media/init', {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      pageId: pageId || undefined,
    });
    const init = initRes.data && initRes.data.data;
    uploadId = init.uploadId;
    totalParts = init.totalParts;
    try { sessionStorage.setItem(key, JSON.stringify({ uploadId })); } catch { /* ignore */ }
  }

  const pending = [];
  for (let n = 1; n <= totalParts; n++) {
    if (!received.includes(n)) pending.push(n);
  }

  let doneCount = received.length;
  const report = () => {
    const percent = Math.min(99, Math.round((doneCount / totalParts) * 100));
    if (onProgress) {
      onProgress({
        percent,
        phase: 'parts',
        part: doneCount,
        totalParts,
      });
    }
  };
  report();

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const n = pending[cursor];
      cursor += 1;
      const start = (n - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const blob = file.slice(start, end);
      await putPartWithRetry({ uploadId, partNumber: n, blob, signal });
      doneCount += 1;
      report();
    }
  }

  const workers = [];
  const parallel = Math.min(MAX_PARALLEL_PARTS, pending.length || 1);
  for (let i = 0; i < parallel; i++) workers.push(worker());
  if (pending.length) await Promise.all(workers);

  if (onProgress) onProgress({ percent: 99, phase: 'complete' });
  const completeRes = await api.post(`/uploads/media/${uploadId}/complete`);
  try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  if (onProgress) onProgress({ percent: 100, phase: 'done' });
  return completeRes.data && completeRes.data.data;
}

export async function abortContentMediaUpload(file) {
  if (!file) return;
  const key = storageKey(file);
  try {
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed && parsed.uploadId) {
      await api.post(`/uploads/media/${parsed.uploadId}/abort`);
    }
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
