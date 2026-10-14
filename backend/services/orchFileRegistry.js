'use strict';

/** In-memory file registry for listing/orchestrator artifacts (lab). */
const FILES = [];

function nowIso() {
  return new Date().toISOString();
}

function register(entry = {}) {
  const rec = {
    id: String(entry.id || `file-${FILES.length + 1}-${Date.now()}`),
    job_id: entry.job_id || null,
    step_id: entry.step_id || null,
    path: String(entry.path || entry.album_path || ''),
    kind: entry.kind || 'file',
    owner_user_id: entry.owner_user_id || null,
    album_slug: entry.album_slug || null,
    media_id: entry.media_id || null,
    created_at: entry.created_at || nowIso(),
  };
  if (!rec.path) return null;
  FILES.push(rec);
  if (FILES.length > 2000) FILES.splice(0, FILES.length - 1000);
  return rec;
}

function listByJob(jobId) {
  const id = String(jobId || '');
  return FILES.filter((item) => String(item.job_id || '') === id);
}

function snapshot() {
  return { count: FILES.length, recent: FILES.slice(-20) };
}

function resetForTests() {
  FILES.length = 0;
}

module.exports = {
  register,
  listByJob,
  snapshot,
  resetForTests,
};
