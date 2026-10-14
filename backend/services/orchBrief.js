'use strict';

const TRUSTED_KEYS = [
  'task_id',
  'agent_id',
  'objective',
  'boundaries',
  'inputs',
  'output_schema',
  'tools_allow',
  'budget',
  'skill_id',
  'parent_task_id',
  'spawn_role',
  'trusted',
];

const REQUIRED = ['task_id', 'agent_id', 'objective', 'boundaries', 'inputs', 'output_schema'];

function err(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildTrustedBrief(opts) {
  const brief = {
    task_id: String(opts.task_id || '').trim(),
    agent_id: String(opts.agent_id || '').trim(),
    objective: String(opts.objective || '').trim(),
    boundaries: String(opts.boundaries || ''),
    inputs: asObject(opts.inputs),
    output_schema: String(opts.output_schema || ''),
    tools_allow: Array.isArray(opts.tools_allow) ? opts.tools_allow.map(String) : [],
    budget: asObject(opts.budget),
    skill_id: opts.skill_id || null,
    parent_task_id: opts.parent_task_id || null,
    spawn_role: opts.spawn_role || 'leaf',
    trusted: {
      run_mode: opts.run_mode || opts.trusted?.run_mode || 'plan',
      owner_user_id: opts.owner_user_id || opts.trusted?.owner_user_id || null,
      target_owner_user_id: opts.target_owner_user_id || opts.trusted?.target_owner_user_id || null,
    },
    untrusted: { csv_text: '', web_snippets: [], retrieved: [] },
  };
  return brief;
}

function attachUntrusted(brief, raw) {
  const src = asObject(raw);
  brief.untrusted = {
    csv_text: String(src.csv_text || src.csv || ''),
    web_snippets: Array.isArray(src.web_snippets) ? src.web_snippets.map(String).slice(0, 40) : [],
    retrieved: Array.isArray(src.retrieved) ? src.retrieved.slice(0, 40) : [],
  };
  return brief;
}

function stripUntrustedOverrides(brief) {
  const untrusted = asObject(brief.untrusted);
  delete untrusted.tools_allow;
  delete untrusted.run_mode;
  delete untrusted.agent_id;
  delete untrusted.spawn_role;
  brief.untrusted = untrusted;
  if (brief.inputs && typeof brief.inputs === 'object') {
    delete brief.inputs.tools_allow;
    delete brief.inputs.run_mode;
    delete brief.inputs.spawn_role;
  }
  return brief;
}

function validateBrief(brief) {
  if (!brief || typeof brief !== 'object') throw err('BAD_BRIEF', 'brief required');
  for (const key of REQUIRED) {
    if (key === 'inputs') {
      if (!brief.inputs || typeof brief.inputs !== 'object') {
        throw err('BRIEF_SCHEMA', `brief.${key} required`);
      }
      continue;
    }
    if (!String(brief[key] || '').trim()) throw err('BRIEF_SCHEMA', `brief.${key} required`);
  }
  if (brief.spawn_role && brief.spawn_role !== 'leaf') {
    throw err('SPAWN_DEPTH', 'v1: только spawn_role=leaf', 400);
  }
  const extra = Object.keys(brief).filter((key) => (
    !TRUSTED_KEYS.includes(key) && key !== 'untrusted'
  ));
  if (extra.length) {
    throw err('BRIEF_SCHEMA', `unexpected trusted field: ${extra.join(',')}`);
  }
  stripUntrustedOverrides(brief);
  return brief;
}

module.exports = {
  TRUSTED_KEYS,
  buildTrustedBrief,
  attachUntrusted,
  stripUntrustedOverrides,
  validateBrief,
};
