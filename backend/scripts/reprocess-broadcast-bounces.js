/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Повторная обработка bounce/NDR писем из INBOX за последние N дней.
 * Использование: node scripts/reprocess-broadcast-bounces.js [days]
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');
const db = require('../db');
const logger = require('../utils/logger');
const emailBounceService = require('../services/emailBounceService');
const encryptionUtils = require('../utils/encryptionUtils');

async function loadEmailSettings() {
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
      decrypt_text(smtp_host_encrypted, $1) as smtp_host,
      decrypt_text(smtp_user_encrypted, $1) as smtp_user,
      decrypt_text(smtp_password_encrypted, $1) as smtp_password,
      decrypt_text(imap_host_encrypted, $1) as imap_host,
      decrypt_text(imap_user_encrypted, $1) as imap_user,
      decrypt_text(imap_password_encrypted, $1) as imap_password,
      decrypt_text(from_email_encrypted, $1) as from_email
     FROM email_settings
     ORDER BY id
     LIMIT 1`,
    [encryptionKey]
  );

  return rows[0] || null;
}

function openInbox(imap) {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', true, (error, box) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(box);
    });
  });
}

function searchMessages(imap, criteria) {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results || []);
    });
  });
}

function fetchMessages(imap, uids) {
  return new Promise((resolve, reject) => {
    if (!uids.length) {
      resolve([]);
      return;
    }

    const messages = [];
    const fetch = imap.fetch(uids, { bodies: '', struct: true });

    fetch.on('message', (msg) => {
      const chunks = [];
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => chunks.push(chunk));
      });
      msg.once('end', () => {
        messages.push(Buffer.concat(chunks));
      });
    });

    fetch.once('error', reject);
    fetch.once('end', () => resolve(messages));
  });
}

function connectImap(settings) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: settings.imap_user,
      password: settings.imap_password,
      host: settings.imap_host,
      port: 993,
      tls: true,
      tlsOptions: {
        rejectUnauthorized: false,
        servername: settings.imap_host
      }
    });

    imap.once('ready', () => resolve(imap));
    imap.once('error', reject);
    imap.connect();
  });
}

function closeImap(imap) {
  return new Promise((resolve) => {
    if (!imap) {
      resolve();
      return;
    }
    imap.once('end', resolve);
    imap.end();
  });
}

async function main() {
  const days = Math.max(Number(process.argv[2]) || 7, 1);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const settings = await loadEmailSettings();
  if (!settings) {
    throw new Error('email_settings not found');
  }

  const imap = await connectImap(settings);

  try {
    await openInbox(imap);
    const uids = await searchMessages(imap, [['SINCE', since]]);
    logger.info(`[ReprocessBounces] Found ${uids.length} messages since ${since.toISOString()}`);

    const rawMessages = await fetchMessages(imap, uids);
    let processedBounces = 0;
    let updatedDeliveries = 0;

    for (const rawMessage of rawMessages) {
      const parsed = await simpleParser(rawMessage);
      if (!emailBounceService.isBounceNotification(parsed)) {
        continue;
      }

      processedBounces += 1;
      const result = await emailBounceService.processBounce(parsed, {
        ownEmail: settings.from_email
      });
      updatedDeliveries += Number(result.processedCount || 0);
      logger.info('[ReprocessBounces] Result:', JSON.stringify(result));
    }

    logger.info(`[ReprocessBounces] Done. bounce_messages=${processedBounces}, updated_deliveries=${updatedDeliveries}`);
  } finally {
    await closeImap(imap);
    process.exit(0);
  }
}

main().catch((error) => {
  logger.error('[ReprocessBounces] Failed:', error);
  process.exit(1);
});
