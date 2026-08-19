/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');
const db = require('../db');
const conferenceService = require('./conferenceService');
const settingsService = require('./voiceCallSettingsService');
const { ensureVoiceCallSchema } = require('./voiceCallSchema');
const { sanitizeReturnUrl } = require('./voiceCallOwner');
const {
  COMMON_TIME_ZONES,
  normalizeBookingHours,
  slotRange,
  partsInZone
} = require('./voiceCallSlotTime');

function bookingPageUrl() {
  return '/book-call';
}

async function requireEditorConfigured() {
  const settings = await settingsService.getSettings();
  if (!settings.booking_editor_user_id) {
    const err = new Error('В настройках не выбран сотрудник для записи');
    err.status = 400;
    err.code = 'EDITOR_NOT_SET';
    throw err;
  }
  const editorId = settings.booking_editor_user_id;
  await settingsService.assertEditorUser(editorId);
  return { settings, editorId };
}

async function listSlots({ from, to } = {}) {
  await ensureVoiceCallSchema();
  const { settings, editorId } = await requireEditorConfigured();
  const all = slotRange(settings, from, to);
  const { rows } = await db.getQuery()(
    `SELECT starts_at FROM ai_call_bookings
     WHERE editor_user_id = $1 AND status <> 'cancelled' AND starts_at >= NOW()`,
    [editorId]
  );
  const taken = new Set(rows.map((r) => new Date(r.starts_at).toISOString()));
  const hours = normalizeBookingHours(settings.booking_hours);
  return {
    editor_user_id: editorId,
    slot_minutes: settings.booking_slot_minutes,
    time_zone: hours.timeZone,
    booking_hours: hours,
    slots: all.filter((iso) => !taken.has(iso)).map((starts_at) => ({ starts_at }))
  };
}

async function listSchedule() {
  await ensureVoiceCallSchema();
  const settings = await settingsService.getSettings();
  const hours = normalizeBookingHours(settings.booking_hours);
  const editorId = settings.booking_editor_user_id;
  let bookings = [];
  if (editorId) {
    const { rows } = await db.getQuery()(
      `SELECT id, starts_at, minutes, status, guest_user_id, conference_id
       FROM ai_call_bookings
       WHERE editor_user_id = $1 AND status <> 'cancelled' AND starts_at >= NOW()
       ORDER BY starts_at ASC
       LIMIT 120`,
      [editorId]
    );
    bookings = rows.map((row) => ({
      id: row.id,
      starts_at: new Date(row.starts_at).toISOString(),
      minutes: Number(row.minutes),
      status: row.status,
      guest_user_id: row.guest_user_id,
      conference_id: row.conference_id
    }));
  }
  return {
    editor_user_id: editorId,
    slot_minutes: settings.booking_slot_minutes,
    booking_hours: hours,
    time_zones: COMMON_TIME_ZONES,
    bookings
  };
}

async function saveSchedule(payload = {}) {
  await ensureVoiceCallSchema();
  const current = await settingsService.getSettings();
  const hours = normalizeBookingHours(
    { ...current.booking_hours, ...(payload.booking_hours || {}) },
    current.booking_hours
  );
  const saved = await settingsService.saveSettings({
    ...current,
    booking_slot_minutes: payload.booking_slot_minutes,
    booking_hours: hours
  });
  return {
    editor_user_id: saved.booking_editor_user_id,
    slot_minutes: saved.booking_slot_minutes,
    booking_hours: saved.booking_hours,
    time_zones: COMMON_TIME_ZONES
  };
}

async function bookSlot(owner, startsAt) {
  await ensureVoiceCallSchema();
  if (owner.ownerType !== 'user') {
    const err = new Error('Чтобы записаться, войдите в аккаунт');
    err.status = 401;
    err.code = 'AUTH_REQUIRED';
    err.returnUrl = sanitizeReturnUrl(bookingPageUrl());
    throw err;
  }
  const { settings, editorId } = await requireEditorConfigured();
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) {
    const err = new Error('Выберите слот в будущем');
    err.status = 400;
    throw err;
  }

  const allowed = slotRange(
    settings,
    new Date(start.getTime() - 12 * 60 * 60 * 1000).toISOString(),
    new Date(start.getTime() + 12 * 60 * 60 * 1000).toISOString()
  );
  if (!allowed.includes(start.toISOString())) {
    const err = new Error('Этот слот не входит в расписание сотрудника');
    err.status = 400;
    err.code = 'SLOT_OUTSIDE_HOURS';
    throw err;
  }

  const id = crypto.randomUUID();
  try {
    await db.getQuery()(
      `INSERT INTO ai_call_bookings (id, editor_user_id, guest_user_id, starts_at, minutes, status)
       VALUES ($1,$2,$3,$4,$5,'scheduled')`,
      [id, editorId, owner.ownerUserId, start.toISOString(), settings.booking_slot_minutes]
    );
  } catch (error) {
    if (String(error.message || '').includes('ai_call_bookings_slot_uidx')) {
      const err = new Error('Этот слот уже занят');
      err.status = 409;
      err.code = 'SLOT_TAKEN';
      throw err;
    }
    throw error;
  }

  const created = await conferenceService.upsertSessionForContact(
    owner.ownerUserId,
    {
      create_new: true,
      title: 'Запись на звонок с сотрудником',
      scheduled_at: start.toISOString(),
      schedule: true,
      notify_email: true,
      notify_telegram: true,
      status: 'scheduled'
    },
    editorId
  );

  await db.getQuery()(
    `UPDATE ai_call_bookings SET conference_id = $2 WHERE id = $1`,
    [id, created.session?.id || null]
  );

  const tz = normalizeBookingHours(settings.booking_hours).timeZone;
  const local = partsInZone(start, tz);
  return {
    booking_id: id,
    editor_user_id: editorId,
    starts_at: start.toISOString(),
    conference_id: created.session?.id || null,
    returnUrl: `/contacts/${editorId}/conference`,
    local_time: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`
  };
}

module.exports = {
  listSlots,
  listSchedule,
  saveSchedule,
  bookSlot,
  slotRange
};
