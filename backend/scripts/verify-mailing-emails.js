/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * SMTP-верификация email из CSV (RCPT TO без отправки письма).
 *
 * Пример:
 *   yarn verify:mailing-emails -- --limit 50
 *   yarn verify:mailing-emails -- --concurrency 3 --delay-ms 800
 *   yarn verify:mailing-emails -- --resume
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const dns = require('dns');
const { promisify } = require('util');
const csv = require('csv-parser');

const resolveMx = promisify(dns.resolveMx);

const DEFAULT_INPUT = path.resolve(__dirname, '..', '..', 'data', 'companies_for_mailing.csv');
const DEFAULT_OUTPUT = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'companies_for_mailing_verified.csv'
);
const DEFAULT_PROGRESS = path.resolve(
  __dirname,
  '..',
  '..',
  'data',
  'companies_for_mailing_verify_progress.json'
);

const DEFAULT_MAIL_FROM = '18900@xn--80aqc0am6d.xn--p1ai';
const DEFAULT_HELO = 'verify.local';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_DELAY_MS = 800;

const SMTP_LINE_END = '\r\n';

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = 'true';
    }
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCsvRows(inputPath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(outputPath, rows, extraColumns) {
  const baseColumns = ['Название', 'Email', 'Домен', 'MX_сервер'];
  const columns = [...baseColumns, ...extraColumns];
  const lines = [columns.join(',')];

  rows.forEach((row) => {
    lines.push(columns.map((col) => csvEscape(row[col] ?? '')).join(','));
  });

  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function loadProgress(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveProgress(progressPath, progress) {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
}

function classifyRcptCode(code) {
  if (code >= 250 && code <= 259) {
    return 'valid';
  }
  if ([550, 551, 553, 554, 555].includes(code)) {
    return 'invalid';
  }
  if ([450, 451, 452, 421, 422].includes(code)) {
    return 'temp_fail';
  }
  return 'unknown';
}

function guardSocket(socket) {
  if (!socket.__verifyMailGuard) {
    socket.__verifyMailGuard = true;
    socket.on('error', () => {
      // ECONNRESET/EPIPE от MX-сервера — не роняем весь процесс
    });
  }
}

function destroySocket(socket) {
  if (!socket || socket.destroyed) {
    return;
  }
  socket.removeAllListeners();
  socket.destroy();
}

function readSmtpResponse(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP timeout'));
    }, timeoutMs);

    function onData(chunk) {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';
      if (/^\d{3} /.test(lastLine)) {
        cleanup();
        const code = Number(lastLine.slice(0, 3));
        resolve({ code, message: lastLine, raw: buffer.trim() });
      }
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      clearTimeout(timer);
      socket.off('data', onData);
      socket.off('error', onError);
    }

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

async function sendCommand(socket, command, timeoutMs) {
  if (command) {
    socket.write(`${command}${SMTP_LINE_END}`);
  }
  return readSmtpResponse(socket, timeoutMs);
}

function connectMx(host, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: 25, timeout: timeoutMs });
    socket.setEncoding('utf8');

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    function cleanup() {
      socket.off('error', onError);
      socket.off('timeout', onTimeout);
    }

    function onTimeout() {
      cleanup();
      socket.destroy();
      reject(new Error('Connection timeout'));
    }

    socket.once('error', onError);
    socket.once('timeout', onTimeout);
    socket.once('connect', () => {
      cleanup();
      guardSocket(socket);
      resolve(socket);
    });
  });
}

async function verifyOnMx(email, mxHost, options) {
  let socket;

  try {
    socket = await connectMx(mxHost, options.timeoutMs);
    await readSmtpResponse(socket, options.timeoutMs);
    await sendCommand(socket, `EHLO ${options.helo}`, options.timeoutMs);
    await sendCommand(socket, `MAIL FROM:<${options.mailFrom}>`, options.timeoutMs);
    const rcpt = await sendCommand(socket, `RCPT TO:<${email}>`, options.timeoutMs);
    await sendCommand(socket, 'QUIT', options.timeoutMs).catch(() => {});
    destroySocket(socket);
    socket = null;

    return {
      status: classifyRcptCode(rcpt.code),
      smtp_code: rcpt.code,
      smtp_message: rcpt.message,
      mx_host: mxHost,
      error: '',
    };
  } catch (error) {
    destroySocket(socket);
    return {
      status: 'error',
      smtp_code: '',
      smtp_message: '',
      mx_host: mxHost,
      error: error.message || String(error),
    };
  }
}

async function resolveBestMx(domain) {
  const records = await resolveMx(domain);
  if (!records || records.length === 0) {
    throw new Error('MX not found');
  }
  return records.sort((a, b) => a.priority - b.priority)[0].exchange;
}

async function verifyEmail(email, options) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) {
    return {
      status: 'invalid',
      smtp_code: '',
      smtp_message: '',
      mx_host: '',
      error: 'Invalid email format',
    };
  }

  const domain = normalized.split('@')[1];

  try {
    const mxHost = await resolveBestMx(domain);
    const result = await verifyOnMx(normalized, mxHost, options);

    if (options.catchAllCheck && result.status === 'valid') {
      const probeLocal = `probe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const probeEmail = `${probeLocal}@${domain}`;
      const probe = await verifyOnMx(probeEmail, mxHost, options);
      if (probe.status === 'valid') {
        return {
          ...result,
          status: 'catch_all',
          smtp_message: `${result.smtp_message} | catch-all detected`,
        };
      }
    }

    return result;
  } catch (error) {
    return {
      status: 'error',
      smtp_code: '',
      smtp_message: '',
      mx_host: '',
      error: error.message || String(error),
    };
  }
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (index < items.length) {
      const current = index;
      index += 1;
      try {
        results[current] = await worker(items[current], current);
      } catch (error) {
        console.error('[verify] необработанная ошибка worker:', error.message || error);
        results[current] = null;
      }
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => runner());
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = path.resolve(args.input || DEFAULT_INPUT);
  const outputPath = path.resolve(args.output || DEFAULT_OUTPUT);
  const progressPath = path.resolve(args.progress || DEFAULT_PROGRESS);
  const limit = args.limit ? Number(args.limit) : null;
  const concurrency = args.concurrency ? Number(args.concurrency) : DEFAULT_CONCURRENCY;
  const delayMs = args['delay-ms'] ? Number(args['delay-ms']) : args.delay ? Number(args.delay) : DEFAULT_DELAY_MS;
  const timeoutMs = args.timeout ? Number(args.timeout) : DEFAULT_TIMEOUT_MS;
  const resume = args.resume === 'true';
  const catchAllCheck = args['catch-all-check'] === 'true';

  const options = {
    mailFrom: args['mail-from'] || DEFAULT_MAIL_FROM,
    helo: args.helo || DEFAULT_HELO,
    timeoutMs,
    catchAllCheck,
  };

  if (!fs.existsSync(inputPath)) {
    console.error(`CSV не найден: ${inputPath}`);
    process.exit(1);
  }

  const rows = await readCsvRows(inputPath);
  const targetRows = Number.isFinite(limit) && limit > 0 ? rows.slice(0, limit) : rows;
  const progress = resume ? loadProgress(progressPath) : {};

  console.log(`Входной файл: ${inputPath}`);
  console.log(`Строк к проверке: ${targetRows.length}`);
  console.log(`Параллелизм: ${concurrency}, пауза: ${delayMs} ms`);
  console.log(`MAIL FROM: ${options.mailFrom}`);
  console.log(`Catch-all check: ${catchAllCheck ? 'да' : 'нет'}`);
  console.log('');

  const stats = {
    valid: 0,
    invalid: 0,
    temp_fail: 0,
    catch_all: 0,
    error: 0,
    skipped: 0,
    unknown: 0,
  };

  const verifiedRows = [];

  const queue = targetRows.map((row, idx) => ({ row, idx }));
  const pending = queue.filter(({ row }) => {
    const email = String(row.Email || '').trim().toLowerCase();
    if (resume && progress[email]) {
      stats.skipped += 1;
      verifiedRows.push({ ...row, ...progress[email] });
      return false;
    }
    return true;
  });

  let processed = stats.skipped;

  await runWithConcurrency(pending, concurrency, async ({ row }) => {
    const email = String(row.Email || '').trim().toLowerCase();
    const result = await verifyEmail(email, options);

    const enriched = {
      ...row,
      verify_status: result.status,
      verify_smtp_code: result.smtp_code,
      verify_smtp_message: result.smtp_message,
      verify_mx_host: result.mx_host,
      verify_error: result.error,
      verified_at: new Date().toISOString(),
    };

    progress[email] = {
      verify_status: enriched.verify_status,
      verify_smtp_code: enriched.verify_smtp_code,
      verify_smtp_message: enriched.verify_smtp_message,
      verify_mx_host: enriched.verify_mx_host,
      verify_error: enriched.verify_error,
      verified_at: enriched.verified_at,
    };

    verifiedRows.push(enriched);
    stats[result.status] = (stats[result.status] || 0) + 1;
    processed += 1;

    if (processed % 25 === 0 || processed === targetRows.length) {
      saveProgress(progressPath, progress);
      writeCsv(outputPath, verifiedRows, [
        'verify_status',
        'verify_smtp_code',
        'verify_smtp_message',
        'verify_mx_host',
        'verify_error',
        'verified_at',
      ]);
      console.log(
        `[${processed}/${targetRows.length}] valid=${stats.valid} invalid=${stats.invalid} temp=${stats.temp_fail} catch_all=${stats.catch_all} error=${stats.error}`
      );
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  });

  saveProgress(progressPath, progress);
  writeCsv(outputPath, verifiedRows, [
    'verify_status',
    'verify_smtp_code',
    'verify_smtp_message',
    'verify_mx_host',
    'verify_error',
    'verified_at',
  ]);

  console.log('\nГотово.');
  console.log(`Результат: ${outputPath}`);
  console.log(`Прогресс: ${progressPath}`);
  console.log('Статистика:', stats);
}

main().catch((error) => {
  console.error('Ошибка:', error);
  process.exit(1);
});
