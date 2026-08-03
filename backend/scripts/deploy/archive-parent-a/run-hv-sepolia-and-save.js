#!/usr/bin/env node
/* DEPRECATED 2026-08-03 — Parent A soft-retired. Writes only to contracts-data/archive/. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.env.ALLOW_DEPRECATED_PARENT_A_DEPLOY !== '1') {
  console.error(
    'run-hv-sepolia-and-save.js DEPRECATED. Set ALLOW_DEPRECATED_PARENT_A_DEPLOY=1 to override.'
  );
  process.exit(1);
}

const outDir = path.join(__dirname, '../contracts-data/archive');
fs.mkdirSync(outDir, { recursive: true });

const chunks = [];
const p = spawn('npx', ['hardhat', 'run', 'scripts/deploy/deploy-hv-sepolia-test.js'], {
  cwd: path.join(__dirname, '../..'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

p.stdout.on('data', (d) => {
  const s = d.toString();
  process.stdout.write(s);
  chunks.push(s);
});
p.stderr.on('data', (d) => {
  const s = d.toString();
  process.stderr.write(s);
  chunks.push(s);
});

p.on('close', (code) => {
  const text = chunks.join('');
  fs.writeFileSync(path.join(outDir, 'hv-sepolia-deploy-raw.log'), text);
  const start = text.lastIndexOf('{');
  let saved = false;
  if (start >= 0) {
    // find matching from last occurrence of treasuryBridge block — parse lines after Deploying
    const idx = text.lastIndexOf('\n{\n');
    const from = idx >= 0 ? idx + 1 : text.lastIndexOf('{');
    const slice = text.slice(from);
    const end = slice.indexOf('\n}');
    if (end >= 0) {
      const jsonText = slice.slice(0, end + 2);
      try {
        const obj = JSON.parse(jsonText);
        if (obj.dleA && obj.treasuryBridge) {
          fs.writeFileSync(
            path.join(outDir, 'hv-sepolia-deploy.json'),
            JSON.stringify(obj, null, 2) + '\n'
          );
          console.log('SAVED_JSON_OK', obj.dleA, obj.treasuryBridge);
          saved = true;
        }
      } catch (e) {
        console.error('JSON parse fail', e.message);
      }
    }
  }
  if (!saved) console.error('NO_JSON_SAVED');
  process.exit(code || (saved ? 0 : 1));
});
