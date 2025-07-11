const WebSocket = require('ws');

let wss = null;
const wsClients = new Set();

function initWSS(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.on('close', () => wsClients.delete(ws));
  });
}

function broadcastContactsUpdate() {
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'contacts-updated' }));
    }
  }
}

function broadcastMessagesUpdate() {
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'messages-updated' }));
    }
  }
}

module.exports = { initWSS, broadcastContactsUpdate, broadcastMessagesUpdate }; 