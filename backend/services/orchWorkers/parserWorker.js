'use strict';

const { parseListingCsv } = require('../listingCsv');
const { attachUntrusted } = require('../orchBrief');

async function run(brief) {
  const inputs = brief.inputs || {};
  attachUntrusted(brief, {
    csv_text: inputs.csv_text || inputs.csv || '',
    web_snippets: inputs.web_snippets,
  });
  const parsed = parseListingCsv(brief.untrusted.csv_text || inputs.csv_text || '');
  if (!parsed.candidates.length) {
    return {
      status: 'need_input',
      summary: 'parser: no brand/model in CSV',
      agent_id: 'parser',
      data: { rows: parsed.rows, candidates: [], reason: 'no_targets' },
    };
  }
  return {
    status: 'ok',
    summary: `parser: ${parsed.candidates.length} targets`,
    agent_id: 'parser',
    data: {
      rows: parsed.rows,
      candidates: parsed.candidates,
    },
  };
}

module.exports = { run };
