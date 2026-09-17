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
}) {
  const body = new FormData();
  body.append('message', message || '');
  body.append('history', JSON.stringify(history || []));
  body.append('driveIds', JSON.stringify(driveIds || []));
  body.append('skillId', skillId || '');
  for (const file of files) {
    if (file) body.append('examples', file);
  }
  const { data } = await api.post('/media-agent/turn', body);
  return data;
}

export async function fetchMediaAgentJob(id) {
  const { data } = await api.get(`/media-agent/jobs/${encodeURIComponent(id)}`);
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
