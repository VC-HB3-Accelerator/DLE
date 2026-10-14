/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

import api from '@/api/axios';

export async function postMediaAgentTurn({
  message,
  history,
  files = [],
  driveIds = [],
  skillId = '',
  targetOwnerUserId = null,
  csvText = '',
  csvName = '',
  sessionId = '',
}) {
  const body = new FormData();
  body.append('message', message || '');
  body.append('history', JSON.stringify(history || []));
  body.append('driveIds', JSON.stringify(driveIds || []));
  body.append('skillId', skillId || '');
  if (sessionId) body.append('sessionId', sessionId);
  if (targetOwnerUserId) body.append('targetOwnerUserId', String(targetOwnerUserId));
  if (csvText) {
    body.append('csvText', csvText);
    body.append('csvName', csvName || 'upload.csv');
  }
  for (const file of files) {
    if (file) body.append('examples', file);
  }
  const { data } = await api.post('/media-agent/turn', body);
  return data;
}

export async function fetchMediaAgentJobs() {
  const { data } = await api.get('/media-agent/jobs');
  return data;
}

export async function fetchMediaAgentJob(id) {
  const { data } = await api.get(`/media-agent/jobs/${encodeURIComponent(id)}`);
  return data;
}

export async function cancelMediaAgentJob(id) {
  const { data } = await api.post(`/media-agent/jobs/${encodeURIComponent(id)}/cancel`);
  return data;
}

export async function fetchMediaAgentStatus() {
  const { data } = await api.get('/media-agent/status');
  return data;
}

export async function fetchMediaAgentSkills() {
  const { data } = await api.get('/media-agent/skills');
  return data;
}

export async function installMediaAgentSkill(id) {
  const { data } = await api.post('/media-agent/skills/install', { id });
  return data;
}

export async function uploadMediaAgentSkill(file) {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/media-agent/skills/upload', body);
  return data;
}

export async function deleteMediaAgentSkill(id) {
  const { data } = await api.delete(`/media-agent/skills/${encodeURIComponent(id)}`);
  return data;
}

export async function startListingPool({ brand, model, target = 8 }) {
  const { data } = await api.post('/media-agent/listing-pool/start', { brand, model, target });
  return data;
}

export async function fetchListingPool(id) {
  const { data } = await api.get(`/media-agent/listing-pool/${encodeURIComponent(id)}`);
  return data;
}

export async function dropListingPoolPhoto(poolId, file) {
  const { data } = await api.delete(
    `/media-agent/listing-pool/${encodeURIComponent(poolId)}/photos/${encodeURIComponent(file)}`
  );
  return data;
}

export async function dropListingPoolPhotos(poolId, files) {
  const { data } = await api.post(`/media-agent/listing-pool/${encodeURIComponent(poolId)}/drop`, {
    files,
  });
  return data;
}

export async function fetchListingBatches() {
  const { data } = await api.get('/media-agent/listing-batch');
  return data;
}

export async function uploadListingCsv(file) {
  const body = new FormData();
  body.append('csv', file);
  const { data } = await api.post('/media-agent/listing-batch/csv', body);
  return data;
}

export async function fetchListingBatch(id) {
  const { data } = await api.get(`/media-agent/listing-batch/${encodeURIComponent(id)}`);
  return data;
}

export async function tickListingBatch(id) {
  const { data } = await api.post(`/media-agent/listing-batch/${encodeURIComponent(id)}/tick`);
  return data;
}

export async function respondListingBatch(id, body) {
  const { data } = await api.post(
    `/media-agent/listing-batch/${encodeURIComponent(id)}/respond`,
    body || {}
  );
  return data;
}

export async function execOrchestratorTool({ tool, args = {}, jobId = null, decision = '', text = '' }) {
  const { data } = await api.post('/media-agent/tools/exec', {
    tool,
    args,
    jobId,
    decision,
    text,
  });
  return data;
}

export async function chooseOrchestratorPlan(id, { optionId, decision = 'choose', text = '' }) {
  const { data } = await api.post(
    `/media-agent/plan/${encodeURIComponent(id)}/choose`,
    { option_id: optionId, decision, text }
  );
  return data;
}

export async function decideListingBatchPlan(id, decision) {
  const { data } = await api.post(
    `/media-agent/listing-batch/${encodeURIComponent(id)}/approval`,
    { decision }
  );
  return data;
}

export async function cancelListingBatch(id) {
  const { data } = await api.post(
    `/media-agent/listing-batch/${encodeURIComponent(id)}/cancel`
  );
  return data;
}

export async function startFreshMediaAgentSession(contactId) {
  const { data } = await api.post('/media-agent/sessions/fresh', {
    contactId: contactId || null,
  });
  return data;
}

export async function resumeMediaAgentSession(id) {
  const { data } = await api.post(`/media-agent/sessions/${encodeURIComponent(id)}/resume`);
  return data;
}

export async function createMediaAgentSession(contactId) {
  const { data } = await api.post('/media-agent/sessions', {
    contactId: contactId || null,
  });
  return data;
}

export async function fetchMediaAgentSessions(contactId) {
  const params = {};
  if (contactId) params.contactId = contactId;
  const { data } = await api.get('/media-agent/sessions', { params });
  return data;
}

export async function saveMediaAgentSession(session, contactId) {
  const { data } = await api.put(
    `/media-agent/sessions/${encodeURIComponent(session.id)}`,
    {
      contactId: contactId || null,
      title: session.title,
      skillId: session.skillId,
      messages: session.messages,
    }
  );
  return data;
}

export async function deleteMediaAgentSession(id) {
  const { data } = await api.delete(`/media-agent/sessions/${encodeURIComponent(id)}`);
  return data;
}

export async function fetchContactAiMode(contactId) {
  const { data } = await api.get(
    `/media-agent/contact-prefs/${encodeURIComponent(contactId)}`
  );
  return data;
}

export async function saveContactAiMode(contactId, aiEnabled) {
  const { data } = await api.put(
    `/media-agent/contact-prefs/${encodeURIComponent(contactId)}`,
    { aiEnabled: Boolean(aiEnabled) }
  );
  return data;
}
