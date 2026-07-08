/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const BOUNCE_SUBJECT_PATTERNS = [
  /^undeliverable:/i,
  /delivery has failed/i,
  /mail delivery failed/i,
  /failure notice/i,
  /returned mail/i,
  /delivery status notification/i,
  /недоставлен/i,
  /не доставлен/i
];

const SYSTEM_FROM_PATTERNS = [
  /mailer-daemon/i,
  /postmaster@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /bounce@/i,
  /daemon@/i,
  /microsoft exchange/i
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function collectTextParts(parsed) {
  const parts = [
    parsed?.subject || '',
    parsed?.text || '',
    parsed?.html || ''
  ];

  if (Array.isArray(parsed?.attachments)) {
    for (const attachment of parsed.attachments) {
      if (!attachment?.content) {
        continue;
      }

      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content.toString('utf8')
        : String(attachment.content);

      parts.push(content);
    }
  }

  return parts.filter(Boolean).join('\n');
}

function extractEmails(text) {
  const matches = String(text || '').match(EMAIL_REGEX) || [];
  return [...new Set(matches.map(email => email.toLowerCase()))];
}

function isSystemAddress(email) {
  const normalized = String(email || '').toLowerCase();
  return SYSTEM_FROM_PATTERNS.some(pattern => pattern.test(normalized));
}

function isBounceNotification(parsed) {
  const fromEmail = parsed?.from?.value?.[0]?.address || '';
  const subject = parsed?.subject || '';
  const combined = collectTextParts(parsed);

  if (fromEmail && isSystemAddress(fromEmail)) {
    return true;
  }

  if (BOUNCE_SUBJECT_PATTERNS.some(pattern => pattern.test(subject))) {
    return true;
  }

  return /delivery has failed|undeliverable|diagnostic information for administrators|final-recipient:|x-failed-recipients:/i
    .test(combined);
}

function extractDiagnosticMessage(text) {
  const normalized = String(text || '');

  const remoteMatch = normalized.match(/Remote Server returned '([^']+)'/i);
  if (remoteMatch) {
    return remoteMatch[1].trim();
  }

  const diagnosticMatch = normalized.match(/Diagnostic-Code:\s*smtp;\s*(.+)/i);
  if (diagnosticMatch) {
    return diagnosticMatch[1].trim();
  }

  const statusMatch = normalized.match(/Status:\s*([^\n]+)/i);
  if (statusMatch) {
    return statusMatch[1].trim();
  }

  return 'Отказ доставки (bounce/NDR)';
}

function extractFailedRecipients(parsed, ownEmail = null) {
  const text = collectTextParts(parsed);
  const recipients = new Set();
  const own = String(ownEmail || '').trim().toLowerCase();

  for (const match of text.matchAll(/Final-Recipient:\s*rfc822;\s*<?([^>\s;]+)>?/gi)) {
    recipients.add(match[1].toLowerCase());
  }

  for (const match of text.matchAll(/X-Failed-Recipients:\s*<?([^>\s;]+)>?/gi)) {
    recipients.add(match[1].toLowerCase());
  }

  const failedBlock = text.match(
    /Delivery has failed to these recipients(?: or groups)?:\s*([\s\S]*?)(?:\n\s*\n|Diagnostic information for administrators:|$)/i
  );
  if (failedBlock) {
    extractEmails(failedBlock[1]).forEach(email => recipients.add(email));
  }

  for (const match of text.matchAll(/^\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\s*$/gm)) {
    const email = match[1].toLowerCase();
    if (!isSystemAddress(email)) {
      recipients.add(email);
    }
  }

  if (own) {
    recipients.delete(own);
  }

  return [...recipients].filter(email => !isSystemAddress(email));
}

function parseBounceNotification(parsed, ownEmail = null) {
  if (!isBounceNotification(parsed)) {
    return null;
  }

  const text = collectTextParts(parsed);
  const failedRecipients = extractFailedRecipients(parsed, ownEmail);
  const diagnosticMessage = extractDiagnosticMessage(text);

  return {
    bounceMessageId: parsed?.messageId || null,
    subject: parsed?.subject || '',
    failedRecipients,
    diagnosticMessage,
    receivedAt: parsed?.date || new Date()
  };
}

module.exports = {
  isBounceNotification,
  parseBounceNotification,
  extractFailedRecipients,
  extractDiagnosticMessage
};
