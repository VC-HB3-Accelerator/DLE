'use strict';

const TABLE = 'orchestrator_decisions';

function queryFn(override) {
  if (override) return override;
  try {
    return require('../db').getQuery();
  } catch {
    return null;
  }
}

function err(code, message, status = 409) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalize(input = {}) {
  const status = String(input.status || 'proposed');
  if (!['proposed', 'active', 'superseded', 'rejected'].includes(status)) {
    throw err('DECISION_STATUS', `invalid decision status ${status}`, 400);
  }
  return {
    id: String(input.id || '').trim(),
    scope: String(input.scope || '').trim(),
    status,
    decision: String(input.decision || '').trim(),
    rationale: input.rationale ? String(input.rationale) : null,
    evidence: Array.isArray(input.evidence) ? input.evidence : [],
    verified_at: input.verified_at || null,
    review_after: input.review_after || null,
    supersedes: Array.isArray(input.supersedes) ? input.supersedes.map(String) : [],
  };
}

async function listDecisions(criteria = {}, options = {}) {
  const query = queryFn(options.query);
  if (!query) return [];
  const clauses = ['TRUE'];
  const params = [];
  if (criteria.scope) {
    params.push(String(criteria.scope));
    clauses.push(`scope = $${params.length}`);
  }
  if (criteria.status) {
    params.push(String(criteria.status));
    clauses.push(`status = $${params.length}`);
  }
  const { rows } = await query(
    `SELECT * FROM ${TABLE} WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
    params
  );
  return rows || [];
}

async function saveDecision(input, options = {}) {
  const row = normalize(input);
  if (!row.id || !row.scope || !row.decision) {
    throw err('DECISION_REQUIRED', 'decision id, scope and decision are required', 400);
  }
  const query = queryFn(options.query);
  if (!query) return { ...row, persisted: false };
  const { rows } = await query(
    `INSERT INTO ${TABLE} (
       id, scope, status, decision, rationale, evidence,
       verified_at, review_after, supersedes
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status,
       decision = EXCLUDED.decision,
       rationale = EXCLUDED.rationale,
       evidence = EXCLUDED.evidence,
       verified_at = EXCLUDED.verified_at,
       review_after = EXCLUDED.review_after,
       supersedes = EXCLUDED.supersedes
     RETURNING *`,
    [
      row.id,
      row.scope,
      row.status,
      row.decision,
      row.rationale,
      JSON.stringify(row.evidence),
      row.verified_at,
      row.review_after,
      row.supersedes,
    ]
  );
  return rows[0] || row;
}

const ACTIVE_SEED = [
  {
    id: 'ADR-001',
    scope: 'orchestrator.product',
    decision: 'Оркестратор понимает задачу ОС и предлагает 2–3 варианта до execute',
    rationale: 'Снять хардкод 8+1 можно только после выбора варианта',
    review_after: '2026-12-31',
    supersedes: [],
  },
  {
    id: 'ADR-002',
    scope: 'listing.keep_target',
    decision: '8+1 — skill default, не константа runtime; keep_target и video берутся из выбранного plan option',
    rationale: 'Временный хардкод CSV=8 живёт только как fallback, если option не задал число',
    review_after: '2026-10-31',
    supersedes: [],
  },
  {
    id: 'ADR-003',
    scope: 'router.models',
    decision: 'Имена моделей только в orchModelRouter / Settings',
    rationale: 'Инцидент 22.09: списки в сервисах',
    review_after: '2026-10-15',
    supersedes: [],
  },
  {
    id: 'ADR-004',
    scope: 'provider.discovery',
    decision: 'Token Plan = compatible /models; paygo = native /api/v1/models + /quotas',
    rationale: 'W03/W24',
    review_after: '2026-10-31',
    supersedes: [],
  },
  {
    id: 'ADR-005',
    scope: 'orch.chat',
    decision: 'Беседа личная на id; editor не читает и не пишет чужие реплики',
    rationale: 'TZ_ORCHESTRATOR_CARDS §8.2–8.3',
    review_after: '2026-10-31',
    supersedes: ['TZ_MEDIA_AGENT v1 editor-only'],
  },
  {
    id: 'ADR-006',
    scope: 'orch.product',
    decision: 'Карточка из описания: файлы и поиск, schema, медиа по параметрам человека. 8+1 — fallback',
    rationale: 'TZ_ORCHESTRATOR_CARDS §0, §11',
    review_after: '2026-12-31',
    supersedes: ['photos-first / listing-only startTurn'],
  },
];

async function ensureActiveSeed(options = {}) {
  const query = queryFn(options.query);
  if (!query) return;
  for (const row of ACTIVE_SEED) {
    await query(
      `INSERT INTO ${TABLE} (
         id, scope, status, decision, rationale, evidence, review_after, supersedes
       ) VALUES ($1, $2, 'active', $3, $4, '[]'::jsonb, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.scope,
        row.decision,
        row.rationale,
        row.review_after,
        row.supersedes,
      ]
    );
  }
}

async function assertNoActiveConflict(scope, options = {}) {
  const active = await listDecisions({ scope, status: 'active' }, options);
  if (active.length > 1) {
    const error = err(
      'BLOCKED_ASK',
      `Конфликт активных решений в scope «${scope}». Нужен явный выбор.`,
      409
    );
    error.status_job = 'blocked_ask';
    error.decisions = active.map((row) => row.id);
    throw error;
  }
  return active[0] || null;
}

module.exports = {
  TABLE,
  normalize,
  listDecisions,
  saveDecision,
  ensureActiveSeed,
  assertNoActiveConflict,
  ACTIVE_SEED,
};
