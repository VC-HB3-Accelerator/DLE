/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Повтор пишущего вызова: Postgres, в тестах без БД — память процесса.
 */

const memory = new Map();

function useMemory() {
  return Boolean(process.env.NODE_TEST_CONTEXT) && !process.env.ORCH_INTEGRATION_DB;
}

async function remember(key, value) {
  const row = { ...value, replayed: false };
  if (useMemory()) {
    memory.set(key, row);
    return { ...row };
  }
  try {
    const db = require('../db');
    await db.getQuery()(
      `INSERT INTO orchestrator_tool_effects (idempotency_key, tool, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, String(value.tool || 'tool'), JSON.stringify(value)]
    );
    return { ...row };
  } catch {
    memory.set(key, row);
    return { ...row };
  }
}

async function replay(key) {
  if (useMemory()) {
    const prev = memory.get(key);
    return prev ? { ...prev, replayed: true } : null;
  }
  try {
    const db = require('../db');
    const { rows } = await db.getQuery()(
      'SELECT payload FROM orchestrator_tool_effects WHERE idempotency_key = $1 LIMIT 1',
      [key]
    );
    if (rows[0]?.payload) return { ...rows[0].payload, replayed: true };
  } catch {
    /* fall through */
  }
  const prev = memory.get(key);
  return prev ? { ...prev, replayed: true } : null;
}

function resetEffects() {
  memory.clear();
}

module.exports = {
  remember,
  replay,
  resetEffects,
};
