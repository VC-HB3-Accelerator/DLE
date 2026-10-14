'use strict';

const { allowedTools } = require('./orchAgentRegistry');
const { getTool } = require('./orchToolCatalog');

function err(code, message, status = 403) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function freezeToolsAllow(agentId, requested) {
  const registryTools = new Set(allowedTools(agentId));
  const asked = Array.isArray(requested) ? requested.map(String) : [];
  const frozen = [];
  for (const toolId of asked) {
    if (!registryTools.has(toolId)) continue;
    if (!getTool(toolId)) continue;
    if (!frozen.includes(toolId)) frozen.push(toolId);
  }
  return frozen;
}

const TOOL_SCHEMAS = {
  'media.ingest_to_album': { required: ['path'] },
  'media_agent.generate_image': { required: ['prompt'] },
  'site_parser.start_job': { required: ['user_ids'] },
  'broadcast.personalize': { required: ['recipient'] },
  'rag.answer': { required: ['query'] },
  search_web: { required: ['query'] },
  'search.pages': { required: ['query'] },
  fetch_url: { required: ['url'] },
  spawn_agent: { required: ['agent_id', 'objective'] },
  'file.parse': { required: [] },
  'tables.create': { required: ['name'] },
  'tables.add_columns': { required: ['columns'] },
  'tables.add_rows': { required: ['rows'] },
  'tables.enrich': { required: [] },
  'listing.create_draft': { required: ['brief'] },
  'store.create_draft': { required: ['brief'] },
  'card.plan_media': { required: ['brief'] },
  'card.generate_slot': { required: ['slot_id'] },
  'listing.attach_media': { required: ['slots'] },
  'store.attach_media': { required: ['slots'] },
  'card.publish': { required: [] },
};

function validateToolArgs(toolId, args = {}) {
  const id = String(toolId || '').trim();
  const catalogTool = getTool(id);
  const schema = catalogTool?.input_json_schema || TOOL_SCHEMAS[id];
  if (!schema) return true;
  const required = schema.required || [];
  for (const key of required) {
    if (args[key] == null || args[key] === '') {
      throw err('TOOL_SCHEMA', `tool ${id} missing ${key}`, 400);
    }
  }
  return true;
}

function assertTool(toolId, { agentId, brief, args } = {}) {
  const id = String(toolId || '').trim();
  const allowed = new Set(freezeToolsAllow(agentId, brief?.tools_allow || []));
  if (!allowed.has(id)) {
    throw err('TOOL_DENIED', `tool ${id} is not allowed for ${agentId || 'agent'}`);
  }
  if (args) validateToolArgs(id, args);
  return true;
}

module.exports = {
  freezeToolsAllow,
  assertTool,
  validateToolArgs,
  TOOL_SCHEMAS,
};
