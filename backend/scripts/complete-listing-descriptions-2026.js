'use strict';

/**
 * Полный пайплайн описаний 2026:
 *   1) слабые лиды  2) hub-классы  3) thin meta ТТХ  4) blurb класса  5) enrich CSV+БД
 *
 *   APPLY=1 node scripts/complete-listing-descriptions-2026.js
 *   APPLY=1 SKIP_THIN=1 — без HTTP-подтягивания thin
 */
const { execSync } = require('child_process');
const path = require('path');

const APPLY = process.env.APPLY === '1';
const SKIP_THIN = process.env.SKIP_THIN === '1';
const ROOT = path.join(__dirname, '..');

function run(label, script, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  if (APPLY) env.APPLY = '1';
  console.error(`\n=== ${label} ===`);
  execSync(`node scripts/${script}`, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
}

function main() {
  run('fix weak type leads', 'fix-weak-type-leads-2026.js');
  run('rebuild class aggregates', 'build-listing-equipment-class-specs-2026.js');
  if (!SKIP_THIN) {
    run('fill thin from official meta', 'fill-thin-listings-from-source-2026.js', {
      DELAY_MS: process.env.DELAY_MS || '350',
    });
  }
  run('enrich model text (CSV+DB)', 'enrich-listing-descriptions-2026.js');
  run('append class blurb', 'apply-class-blurb-to-listings-2026.js');
  if (APPLY) {
    run('sync blurb to DB', 'sync-sku-descriptions-to-db-2026.js');
  }
  run('audit (strict placeholders)', 'audit-listing-descriptions-2026.js', { AUDIT_STRICT: '1' });
  console.error('\n=== complete-listing-descriptions-2026 done ===');
}

main();
