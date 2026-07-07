/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Управление Docker через Unix socket (без docker CLI и без SSH).
 */

const fs = require('fs');
const http = require('http');

const DOCKER_SOCK_PATH = '/var/run/docker.sock';

function isSocketAvailable() {
  return fs.existsSync(DOCKER_SOCK_PATH);
}

function dockerApiRequest(method, apiPath, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCK_PATH,
        path: apiPath,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            const error = new Error(data || `Docker API error ${res.statusCode}`);
            error.statusCode = res.statusCode;
            reject(error);
            return;
          }

          if (!data) {
            resolve(null);
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function listContainers({ all = false } = {}) {
  const query = all ? '?all=1' : '';
  const rows = await dockerApiRequest('GET', `/containers/json${query}`);
  return (rows || []).map((row) => ({
    id: row.Id,
    name: (row.Names?.[0] || '').replace(/^\//, ''),
    status: row.Status,
    image: row.Image,
    state: row.State
  }));
}

async function resolveContainerId(nameOrId) {
  const containers = await listContainers({ all: true });
  const normalized = String(nameOrId || '').trim().replace(/^\//, '');
  const match = containers.find((item) => (
    item.id === normalized
    || item.id.startsWith(normalized)
    || item.name === normalized
    || item.name === `dapp-${normalized}`
  ));

  if (!match) {
    throw new Error(`Контейнер не найден: ${nameOrId}`);
  }

  return match.id;
}

async function restartContainer(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  await dockerApiRequest('POST', `/containers/${id}/restart`);
}

async function stopContainer(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  await dockerApiRequest('POST', `/containers/${id}/stop`);
}

async function startContainer(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  await dockerApiRequest('POST', `/containers/${id}/start`);
}

async function removeContainer(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  await dockerApiRequest('DELETE', `/containers/${id}?force=1`);
}

async function getContainerLogs(nameOrId, tail = 100) {
  const id = await resolveContainerId(nameOrId);
  const safeTail = Math.max(1, Math.min(Number(tail) || 100, 1000));
  const logs = await dockerApiRequest(
    'GET',
    `/containers/${id}/logs?stdout=1&stderr=1&timestamps=0&tail=${safeTail}`
  );
  return String(logs || '');
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KiB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GiB`;
}

async function getContainerStats(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  const stats = await dockerApiRequest('GET', `/containers/${id}/stats?stream=0`);
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus
    || stats.cpu_stats.cpu_usage?.percpu_usage?.length
    || 1;
  const cpuPercent = systemDelta > 0
    ? ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2)
    : '0.00';

  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 0;
  const memUsageStr = `${formatBytes(memUsage)} / ${formatBytes(memLimit)}`;

  const net = stats.networks || {};
  let rx = 0;
  let tx = 0;
  Object.values(net).forEach((iface) => {
    rx += iface.rx_bytes || 0;
    tx += iface.tx_bytes || 0;
  });
  const netIo = `${formatBytes(rx)} / ${formatBytes(tx)}`;

  const blockRead = stats.blkio_stats?.io_service_bytes_recursive
    ?.filter((item) => item.op === 'Read')
    ?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const blockWrite = stats.blkio_stats?.io_service_bytes_recursive
    ?.filter((item) => item.op === 'Write')
    ?.reduce((sum, item) => sum + (item.value || 0), 0) || 0;
  const blockIo = `${formatBytes(blockRead)} / ${formatBytes(blockWrite)}`;

  return {
    cpuPercent: `${cpuPercent}%`,
    memUsage: memUsageStr,
    netIo,
    blockIo
  };
}

async function getAllContainerStats() {
  const containers = await listContainers({ all: false });
  const lines = [];

  for (const container of containers) {
    try {
      const stats = await getContainerStats(container.name);
      lines.push([
        container.name,
        stats.cpuPercent,
        stats.memUsage,
        stats.netIo
      ].join('|'));
    } catch {
      lines.push([container.name, '0.00%', '0B / 0B', '0B / 0B'].join('|'));
    }
  }

  return lines.join('\n');
}

async function inspectContainerImage(nameOrId) {
  const id = await resolveContainerId(nameOrId);
  const info = await dockerApiRequest('GET', `/containers/${id}/json`);
  return info?.Config?.Image || '';
}

/**
 * Эмуляция ограниченного набора docker CLI команд через Engine API.
 */
async function execDockerCliCommand(command) {
  const trimmed = command.trim();

  if (/^docker ps -a\b/.test(trimmed) && trimmed.includes('--format')) {
    const containers = await listContainers({ all: true });
    return {
      code: 0,
      stdout: containers.map((item) => `${item.name}|${item.status}|${item.image}`).join('\n'),
      stderr: ''
    };
  }

  if (/^docker ps -q\b/.test(trimmed)) {
    const containers = await listContainers({ all: false });
    return {
      code: 0,
      stdout: containers.map((item) => item.id).join('\n'),
      stderr: ''
    };
  }

  const restartAllMatch = trimmed.match(/^docker restart (.+)$/);
  if (restartAllMatch) {
    const names = restartAllMatch[1].trim().split(/\s+/).filter(Boolean);
    for (const name of names) {
      await restartContainer(name);
    }
    return { code: 0, stdout: '', stderr: '' };
  }

  const restartMatch = trimmed.match(/^docker restart ([^\s]+)$/);
  if (restartMatch) {
    await restartContainer(restartMatch[1]);
    return { code: 0, stdout: '', stderr: '' };
  }

  const stopMatch = trimmed.match(/^docker stop ([^\s]+)$/);
  if (stopMatch) {
    await stopContainer(stopMatch[1]);
    return { code: 0, stdout: '', stderr: '' };
  }

  const startMatch = trimmed.match(/^docker start ([^\s]+)$/);
  if (startMatch) {
    await startContainer(startMatch[1]);
    return { code: 0, stdout: '', stderr: '' };
  }

  const rmMatch = trimmed.match(/^docker rm ([^\s]+)$/);
  if (rmMatch) {
    await removeContainer(rmMatch[1]);
    return { code: 0, stdout: '', stderr: '' };
  }

  const logsMatch = trimmed.match(/^docker logs --tail (\d+) ([^\s]+)$/);
  if (logsMatch) {
    const logs = await getContainerLogs(logsMatch[2], logsMatch[1]);
    return { code: 0, stdout: logs, stderr: '' };
  }

  const statsSingleMatch = trimmed.match(/^docker stats --no-stream --format "{{\.CPUPerc}}\|{{\.MemUsage}}\|{{\.NetIO}}\|{{\.BlockIO}}" ([^\s]+)$/);
  if (statsSingleMatch) {
    const stats = await getContainerStats(statsSingleMatch[1]);
    return {
      code: 0,
      stdout: [stats.cpuPercent, stats.memUsage, stats.netIo, stats.blockIo].join('|'),
      stderr: ''
    };
  }

  if (/^docker stats --no-stream --format/.test(trimmed)) {
    return {
      code: 0,
      stdout: await getAllContainerStats(),
      stderr: ''
    };
  }

  const inspectMatch = trimmed.match(/^docker inspect ([^\s]+) --format '{{\.Config\.Image}}'$/);
  if (inspectMatch) {
    const image = await inspectContainerImage(inspectMatch[1]);
    return { code: 0, stdout: image, stderr: '' };
  }

  throw new Error(`Docker socket API: неподдерживаемая команда: ${command}`);
}

module.exports = {
  DOCKER_SOCK_PATH,
  isSocketAvailable,
  listContainers,
  restartContainer,
  stopContainer,
  startContainer,
  removeContainer,
  getContainerLogs,
  getContainerStats,
  execDockerCliCommand
};
