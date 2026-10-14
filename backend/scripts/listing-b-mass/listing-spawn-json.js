'use strict';

function parseSpawnStdoutJson(stdout) {
  const blob = String(stdout || '').trim();
  if (!blob) return null;
  const match = blob.match(/\{[\s\S]*\}\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

module.exports = { parseSpawnStdoutJson };
