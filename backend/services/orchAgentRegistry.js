'use strict';

const fs = require('fs');
const path = require('path');

let cache = null;

function registryPath() {
  const candidates = [
    '/host-project/orchestrator/agents/registry.json',
    path.join(__dirname, '../../orchestrator/agents/registry.json'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function loadRegistry() {
  if (cache) return cache;
  const file = registryPath();
  if (!file) {
    cache = { version: 1, agents: [] };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    cache = { version: 1, agents: [] };
  }
  return cache;
}

function getAgent(id) {
  const agentId = String(id || '').trim();
  return (loadRegistry().agents || []).find((agent) => agent.id === agentId) || null;
}

function allowedTools(id) {
  const agent = getAgent(id);
  return Array.isArray(agent?.tools) ? agent.tools.slice() : [];
}

function resetCache() {
  cache = null;
}

module.exports = {
  loadRegistry,
  getAgent,
  allowedTools,
  resetCache,
};
