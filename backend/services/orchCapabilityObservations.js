'use strict';

const crypto = require('crypto');

const TABLE = 'capability_observations';

function queryFn(override) {
  if (override) return override;
  const fs = require('fs');
  const inRuntime = process.env.ORCH_INTEGRATION_DB === '1'
    || process.env.ORCH_PERSIST_SPANS === '1'
    || fs.existsSync('/.dockerenv');
  if (!inRuntime) {
    throw new Error('capability observations require Postgres runtime');
  }
  return require('../db').getQuery();
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function fingerprintCredential({ apiKey, keyType, baseUrl }) {
  return crypto
    .createHash('sha256')
    .update(`${String(keyType || '')}\0${normalizeBaseUrl(baseUrl)}\0${String(apiKey || '')}`)
    .digest('hex');
}

function normalizeObservation(input = {}) {
  const row = {
    connectionId: String(input.connectionId || '').trim(),
    keyType: String(input.keyType || '').trim(),
    credentialFingerprint: String(input.credentialFingerprint || '').trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    endpoint: String(input.endpoint || '').trim(),
    model: String(input.model || '').trim(),
    capability: String(input.capability || '').trim(),
    outcome: String(input.outcome || '').trim(),
    healthScope: String(input.healthScope || 'none').trim(),
    permanent: Boolean(input.permanent),
    retryable: Boolean(input.retryable),
    status: Number.isFinite(Number(input.status)) ? Number(input.status) : null,
    errorCode: input.errorCode ? String(input.errorCode).slice(0, 200) : null,
    errorMessage: input.errorMessage ? String(input.errorMessage).slice(0, 2000) : null,
    latencyMs: Number.isFinite(Number(input.latencyMs))
      ? Math.max(0, Math.round(Number(input.latencyMs)))
      : null,
    metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  };

  for (const key of [
    'connectionId',
    'keyType',
    'credentialFingerprint',
    'baseUrl',
    'endpoint',
    'capability',
    'outcome',
  ]) {
    if (!row[key]) throw new Error(`capability observation requires ${key}`);
  }
  if (!/^[a-f0-9]{64}$/i.test(row.credentialFingerprint)) {
    throw new Error('capability observation requires sha256 credentialFingerprint');
  }
  if (row.expiresAt && Number.isNaN(row.expiresAt.getTime())) {
    throw new Error('capability observation has invalid expiresAt');
  }
  return row;
}

async function recordObservation(input, options = {}) {
  const row = normalizeObservation(input);
  const query = queryFn(options.query);
  const { rows } = await query(
    `INSERT INTO ${TABLE} (
       connection_id, key_type, credential_fingerprint, base_url,
       endpoint, model, capability, outcome, health_scope,
       permanent, retryable, status, error_code, error_message,
       latency_ms, metadata, observed_at, expires_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14,
       $15, $16::jsonb, NOW(), $17
     )
     RETURNING *`,
    [
      row.connectionId,
      row.keyType,
      row.credentialFingerprint,
      row.baseUrl,
      row.endpoint,
      row.model,
      row.capability,
      row.outcome,
      row.healthScope,
      row.permanent,
      row.retryable,
      row.status,
      row.errorCode,
      row.errorMessage,
      row.latencyMs,
      JSON.stringify(row.metadata),
      row.expiresAt,
    ]
  );
  return rows[0] || null;
}

async function listFreshObservations(criteria = {}, options = {}) {
  const query = queryFn(options.query);
  const clauses = ['(expires_at IS NULL OR expires_at > NOW())'];
  const params = [];
  const fields = {
    connectionId: 'connection_id',
    keyType: 'key_type',
    credentialFingerprint: 'credential_fingerprint',
    endpoint: 'endpoint',
    model: 'model',
    capability: 'capability',
    outcome: 'outcome',
  };
  for (const [inputName, column] of Object.entries(fields)) {
    if (criteria[inputName] === undefined || criteria[inputName] === null) continue;
    params.push(String(criteria[inputName]));
    clauses.push(`${column} = $${params.length}`);
  }
  const limit = Math.max(1, Math.min(Number(criteria.limit) || 100, 500));
  params.push(limit);
  const { rows } = await query(
    `SELECT *
       FROM ${TABLE}
      WHERE ${clauses.join(' AND ')}
      ORDER BY observed_at DESC, id DESC
      LIMIT $${params.length}`,
    params
  );
  return rows || [];
}

async function listFreshModelIds(criteria = {}, options = {}) {
  const rows = await listFreshObservations(criteria, options);
  const usable = new Set(['success', 'discovered']);
  return [...new Set(
    rows
      .filter((row) => usable.has(String(row.outcome)))
      .flatMap((row) => [
        row.model,
        ...(Array.isArray(row.metadata?.models) ? row.metadata.models : []),
      ])
      .map((model) => String(model || '').trim())
      .filter(Boolean)
  )];
}

function observationBlocksRoute(row, { connectionId, endpoint, model } = {}) {
  if (!row) return false;
  const permanent = row.permanent === true || row.permanent === 't';
  if (!permanent) return false;
  if (String(row.outcome || '') === 'success') return false;
  const scope = String(row.health_scope || row.healthScope || '');
  const conn = String(row.connection_id || row.connectionId || '');
  const ep = String(row.endpoint || '');
  const mod = String(row.model || '');
  if (scope === 'connection' && conn && conn === String(connectionId || '')) return true;
  if (scope === 'entitlement' && conn === String(connectionId || '') && mod === String(model || '')) {
    return true;
  }
  if (
    scope === 'model_route'
    && conn === String(connectionId || '')
    && ep === String(endpoint || '')
    && mod === String(model || '')
  ) {
    return true;
  }
  return false;
}

function isRouteBlocked(route, rows) {
  return (rows || []).some((row) => observationBlocksRoute(row, route));
}

async function listBlockingObservations(criteria = {}, options = {}) {
  const rows = await listFreshObservations({
    ...criteria,
    limit: criteria.limit || 200,
  }, options);
  return rows.filter((row) => (
    (row.permanent === true || row.permanent === 't')
    && String(row.outcome) === 'failure'
  ));
}

module.exports = {
  TABLE,
  normalizeBaseUrl,
  fingerprintCredential,
  normalizeObservation,
  recordObservation,
  listFreshObservations,
  listFreshModelIds,
  observationBlocksRoute,
  isRouteBlocked,
  listBlockingObservations,
};
