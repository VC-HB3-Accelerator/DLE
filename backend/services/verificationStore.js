/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 */

const path = require('path');
const fs = require('fs');

const baseDir = path.join(__dirname, '../contracts-data/verifications');

function ensureDir() {
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
}

function getFilePath(address) {
  ensureDir();
  const key = String(address || '').toLowerCase();
  return path.join(baseDir, `${key}.json`);
}

function read(address) {
  const fp = getFilePath(address);
  if (!fs.existsSync(fp)) return { address: String(address).toLowerCase(), chains: {} };
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return { address: String(address).toLowerCase(), chains: {} };
  }
}

function write(address, data) {
  const fp = getFilePath(address);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function updateChain(address, chainId, patch) {
  const data = read(address);
  if (!data.chains) data.chains = {};
  const cid = String(chainId);
  data.chains[cid] = { ...(data.chains[cid] || {}), ...patch, chainId: Number(chainId), updatedAt: new Date().toISOString() };
  write(address, data);
  return data;
}

module.exports = { read, write, updateChain };


