'use strict';

/** Удалить .png/.webp/.gif из OBJFIX_ROOT (оставить только .jpg для plan B). */
const fsp = require('fs/promises');
const path = require('path');

const ROOT = process.env.OBJFIX_ROOT || '/tmp/objfix-b';
const APPLY = process.env.APPLY === '1';

async function main() {
  let removed = 0;
  let scanned = 0;
  const names = await fsp.readdir(ROOT);
  for (const name of names) {
    if (!/^\d+$/.test(name)) continue;
    const dir = path.join(ROOT, String(name));
    let files;
    try {
      files = await fsp.readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!/\.(png|webp|gif)$/i.test(f)) continue;
      scanned += 1;
      if (APPLY) {
        await fsp.unlink(path.join(dir, f)).catch(() => {});
        removed += 1;
      }
    }
  }
  console.log(JSON.stringify({ apply: APPLY, rasterFiles: scanned, removed }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
