import path from 'path';
import fs from 'fs';
import { createHelia } from 'helia';
import { unixfs, globSource } from '@helia/unixfs';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const db = require('../db');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function checkDomain(domain) {
  try {
    const records = await dns.resolveAny(domain);
    return { records };
  } catch (e) {
    return { error: e.message };
  }
} 