/**
 * Статистика хоста через /proc (без free/top и без SSH).
 * На prod /proc смонтирован с хоста VDS.
 */

const fs = require('fs').promises;

function getProcRoot() {
  return '/proc';
}

async function readFile(path) {
  return fs.readFile(path, 'utf8');
}

async function getCpuCores() {
  const cpuinfo = await readFile(`${getProcRoot()}/cpuinfo`);
  const count = cpuinfo.split('\n').filter((line) => line.startsWith('processor')).length;
  return count || 1;
}

function parseCpuStatLine(line) {
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] || 0) + (parts[4] || 0);
  const total = parts.reduce((sum, value) => sum + (value || 0), 0);
  return { idle, total };
}

async function getCpuUsagePercent(sampleMs = 200) {
  const readCpuLine = async () => {
    const stat = await readFile(`${getProcRoot()}/stat`);
    const line = stat.split('\n').find((row) => row.startsWith('cpu '));
    return parseCpuStatLine(line || 'cpu');
  };

  const first = await readCpuLine();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const second = await readCpuLine();

  const idleDelta = second.idle - first.idle;
  const totalDelta = second.total - first.total;
  if (totalDelta <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100));
}

async function getMemoryStats() {
  const meminfo = await readFile(`${getProcRoot()}/meminfo`);
  const values = {};

  meminfo.split('\n').forEach((line) => {
    const match = line.match(/^([A-Za-z]+):\s+(\d+)/);
    if (match) {
      values[match[1]] = Number(match[2]);
    }
  });

  const totalKb = values.MemTotal || 0;
  const availableKb = values.MemAvailable
    ?? ((values.MemFree || 0) + (values.Buffers || 0) + (values.Cached || 0));
  const usedKb = Math.max(0, totalKb - availableKb);
  const usage = totalKb > 0 ? (usedKb / totalKb) * 100 : 0;

  return {
    usage: Number(usage.toFixed(2)),
    totalMb: Math.round(totalKb / 1024),
    usedMb: Math.round(usedKb / 1024)
  };
}

async function getNetworkBytes() {
  const netdev = await readFile(`${getProcRoot()}/net/dev`);
  let rxBytes = 0;
  let txBytes = 0;

  netdev.split('\n').slice(2).forEach((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 10 || parts[0] === 'lo:') {
      return;
    }

    rxBytes += Number(parts[1]) || 0;
    txBytes += Number(parts[9]) || 0;
  });

  return { rxBytes, txBytes };
}

async function getHostStats() {
  const [cpuUsage, memory, network, cpuCores] = await Promise.all([
    getCpuUsagePercent(),
    getMemoryStats(),
    getNetworkBytes(),
    getCpuCores()
  ]);

  const totalTrafficMb = (network.rxBytes + network.txBytes) / 1024 / 1024;

  return {
    cpuUsage: Number(cpuUsage.toFixed(2)),
    cpuCores,
    ramUsage: memory.usage,
    ramTotal: memory.totalMb,
    ramUsed: memory.usedMb,
    rxBytes: network.rxBytes,
    txBytes: network.txBytes,
    totalTrafficMb
  };
}

module.exports = {
  getHostStats,
  getCpuUsagePercent,
  getMemoryStats,
  getNetworkBytes,
  getCpuCores
};
