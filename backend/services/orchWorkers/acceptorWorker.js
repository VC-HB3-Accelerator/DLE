'use strict';

/**
 * Deterministic product acceptor. It cannot generate or ingest media.
 */
async function run(brief) {
  const inputs = brief.inputs || {};
  const image = inputs.image_artifact || {};
  const critic = inputs.critic_artifact || {};
  const expectedCount = Math.max(1, Number(inputs.expected_count) || 1);
  const files = Array.isArray(image.data?.files) ? image.data.files : [];
  const verdicts = Array.isArray(critic.data?.results) ? critic.data.results : [];
  const blocking = [];

  if (image.status !== 'ok') blocking.push(`image_status:${image.status || 'missing'}`);
  if (files.length < expectedCount) blocking.push(`image_count:${files.length}/${expectedCount}`);
  if (files.some((file) => file?.ok !== true)) blocking.push('image_fallback_or_failed');
  if (critic.status !== 'ok') blocking.push(`critic_status:${critic.status || 'missing'}`);
  if (critic.data?.soft || verdicts.some((result) => result?.soft)) {
    blocking.push('critic_soft_result');
  }
  if (verdicts.length !== files.length) {
    blocking.push(`critic_count:${verdicts.length}/${files.length}`);
  }
  if (verdicts.some((result) => result?.pass !== true)) blocking.push('critic_rejected_file');

  const accepted = blocking.length === 0;
  return {
    status: accepted ? 'ok' : 'failed',
    summary: accepted
      ? `acceptor: accepted ${files.length} files`
      : `acceptor: blocked (${blocking.join(', ')})`,
    agent_id: 'acceptor',
    data: {
      accepted,
      expected_count: expectedCount,
      file_count: files.length,
      blocking,
    },
  };
}

module.exports = { run };
