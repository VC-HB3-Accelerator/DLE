'use strict';

const WRITE_EFFECTS = new Set([
  'delete',
  'deploy',
  'send',
  'pay',
  'ingest',
  'publish',
  'media_library_ingest',
  'paid_image_generation',
  'paid_video_generation',
  'image_gen',
  'video_gen',
  'internet_search',
]);

function err(code, message, status = 403) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function isCapsNotConsent(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const letters = raw.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-ZА-ЯЁ]/g, '');
  return upper.length / letters.length >= 0.8;
}

function isToneNotConsent(text) {
  const raw = String(text || '');
  if (isCapsNotConsent(raw)) return true;
  return /обязательно|срочно|asap|!!!|пожалуйста\s+сделай/i.test(raw);
}

function isExplicitDecision(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'approve' || v === 'reject' || v === 'choose';
}

function sideEffectsOf(option = {}) {
  return (option.side_effects || []).map(String);
}

function requiresApproval(option = {}) {
  return sideEffectsOf(option).some((effect) => WRITE_EFFECTS.has(effect));
}

function assertExplicitDecision(decision, rawText) {
  if (isToneNotConsent(rawText) && !isExplicitDecision(decision)) {
    throw err('APPROVAL_REQUIRED', 'Тон сообщения не является согласием');
  }
  if (!isExplicitDecision(decision)) {
    throw err('APPROVAL_REQUIRED', 'Нужен явный approve/reject/choose');
  }
  return true;
}

function isPublishDecision(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'approve' || v === 'publish';
}

function assertPublishDecision(decision, rawText) {
  if (isToneNotConsent(rawText) && !isPublishDecision(decision)) {
    throw err('APPROVAL_REQUIRED', 'Капслок и тон не являются согласием на выкладку');
  }
  if (String(decision || '').trim().toLowerCase() === 'reject') {
    throw err('PLAN_REJECTED', 'Выкладка отклонена', 400);
  }
  if (!isPublishDecision(decision)) {
    throw err('APPROVAL_REQUIRED', 'Выкладка ждёт отдельное согласие (approve), не выбор варианта');
  }
  return true;
}

function assertApproved({ option, approval, decision, rawText } = {}) {
  assertExplicitDecision(decision, rawText);
  if (String(decision).toLowerCase() === 'reject') {
    throw err('PLAN_REJECTED', 'План отклонён', 400);
  }
  if (!requiresApproval(option)) return true;
  if (!approval || !['approved', 'choose'].includes(String(approval.status || decision))) {
    throw err('APPROVAL_REQUIRED', 'Side effect ждёт явного согласия на этот план');
  }
  if (approval.plan_version && option.version && Number(approval.plan_version) !== Number(option.version)) {
    throw err('APPROVAL_REQUIRED', 'Согласие относится к другой версии плана');
  }
  return true;
}

module.exports = {
  WRITE_EFFECTS,
  isToneNotConsent,
  isCapsNotConsent,
  isExplicitDecision,
  isPublishDecision,
  requiresApproval,
  sideEffectsOf,
  assertExplicitDecision,
  assertPublishDecision,
  assertApproved,
};
