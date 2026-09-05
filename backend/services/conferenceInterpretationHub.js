/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Регистрация WS-клиентов primary/host для лайв-перевода (озвучка + события).
 */

const WebSocket = require('ws');

/** conferenceId → { primary: WebSocket|null, host: WebSocket|null } */
const rooms = new Map();

function roomFor(conferenceId) {
  const id = Number(conferenceId);
  if (!rooms.has(id)) {
    rooms.set(id, { primary: null, host: null });
  }
  return rooms.get(id);
}

function registerClient(conferenceId, role, ws) {
  const room = roomFor(conferenceId);
  const key = role === 'host' ? 'host' : 'primary';
  room[key] = ws;
  const onClose = () => {
    const r = rooms.get(Number(conferenceId));
    if (r && r[key] === ws) r[key] = null;
  };
  ws.on('close', onClose);
  ws.on('error', onClose);
  return () => {
    try {
      ws.off('close', onClose);
      ws.off('error', onClose);
    } catch (_) {
      /* ignore */
    }
    onClose();
  };
}

function sendJsonToRole(conferenceId, role, payload) {
  const room = rooms.get(Number(conferenceId));
  const key = role === 'host' ? 'host' : 'primary';
  const ws = room?.[key];
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function clearRoom(conferenceId) {
  rooms.delete(Number(conferenceId));
}

module.exports = {
  registerClient,
  sendJsonToRole,
  clearRoom
};
