'use strict';

const fs = require('fs');
const path = require('path');

let cache = null;

function catalogPath() {
  const candidates = [
    '/host-project/orchestrator/tools/catalog.json',
    path.join(__dirname, '../../orchestrator/tools/catalog.json'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function loadCatalog() {
  if (cache) return cache;
  const file = catalogPath();
  if (!file) {
    cache = { version: 1, tools: [] };
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    cache = { version: 1, tools: [] };
  }
  return cache;
}

function getTool(id) {
  const toolId = String(id || '').trim();
  return (loadCatalog().tools || []).find((tool) => tool.id === toolId) || null;
}

function resetCache() {
  cache = null;
}

module.exports = {
  loadCatalog,
  getTool,
  resetCache,
};
