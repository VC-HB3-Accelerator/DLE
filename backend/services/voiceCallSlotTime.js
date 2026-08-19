/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Слоты записи: часовой пояс редактора, а не «часы UTC, показанные локально».
 */

const COMMON_TIME_ZONES = [
  'Europe/Moscow',
  'Europe/Kaliningrad',
  'Europe/Samara',
  'Asia/Yekaterinburg',
  'Asia/Omsk',
  'Asia/Krasnoyarsk',
  'Asia/Irkutsk',
  'Asia/Yakutsk',
  'Asia/Vladivostok',
  'Asia/Magadan',
  'Asia/Kamchatka',
  'Europe/Kiev',
  'Europe/Kyiv',
  'Europe/Minsk',
  'Asia/Almaty',
  'Asia/Tashkent',
  'UTC',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York'
].filter((tz) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (_) {
    return false;
  }
});

function isValidTimeZone(tz) {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: String(tz || '') });
    return true;
  } catch (_) {
    return false;
  }
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < min || i > max) return fallback;
  return i;
}

function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

function offsetMsAt(instant, timeZone) {
  const p = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return asUtc - instant.getTime();
}

function zonedLocalToUtc(timeZone, year, month, day, hour, minute) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = naive;
  for (let i = 0; i < 3; i += 1) {
    const offset = offsetMsAt(new Date(guess), timeZone);
    guess = naive - offset;
  }
  return new Date(guess);
}

function weekdayFromYmd(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dayKeyFromParts(p) {
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function normalizeBookingHours(raw, fallback) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const fb = fallback || {
    startHour: 9,
    endHour: 18,
    timeZone: 'Europe/Moscow',
    weekdays: [1, 2, 3, 4, 5]
  };
  const startHour = clampInt(src.startHour ?? src.startUtc, fb.startHour ?? 9, 0, 23);
  const endHour = clampInt(src.endHour ?? src.endUtc, fb.endHour ?? 18, 1, 24);
  let timeZone = String(src.timeZone || fb.timeZone || 'Europe/Moscow').trim();
  if (!isValidTimeZone(timeZone)) timeZone = 'Europe/Moscow';
  let weekdays = Array.isArray(src.weekdays)
    ? src.weekdays.map((n) => clampInt(n, -1, 0, 6)).filter((n) => n >= 0)
    : (fb.weekdays || [1, 2, 3, 4, 5]);
  weekdays = [...new Set(weekdays)].sort((a, b) => a - b);
  if (!weekdays.length) weekdays = [1, 2, 3, 4, 5];
  const safeEnd = endHour > startHour ? endHour : Math.min(24, startHour + 1);
  return {
    startHour,
    endHour: safeEnd,
    startUtc: startHour,
    endUtc: safeEnd,
    timeZone,
    weekdays
  };
}

function slotRange(settings, fromIso, toIso) {
  const hours = normalizeBookingHours(settings?.booking_hours);
  const tz = hours.timeZone;
  const step = Math.max(10, Number(settings?.booking_slot_minutes) || 30) * 60 * 1000;
  const from = fromIso ? new Date(fromIso) : new Date();
  const to = toIso ? new Date(toIso) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) {
    return [];
  }
  const fromParts = partsInZone(from, tz);
  let cursor = zonedLocalToUtc(tz, fromParts.year, fromParts.month, fromParts.day, hours.startHour, 0);
  if (cursor.getTime() < from.getTime()) {
    const extra = Math.ceil((from.getTime() - cursor.getTime()) / step);
    cursor = new Date(cursor.getTime() + extra * step);
  }
  const slots = [];
  const end = to.getTime();
  const minStart = Date.now() + 5 * 60 * 1000;
  let guard = 0;
  while (cursor.getTime() < end && guard < 2500) {
    guard += 1;
    const p = partsInZone(cursor, tz);
    const minutes = p.hour * 60 + p.minute;
    const wd = weekdayFromYmd(p.year, p.month, p.day);
    if (
      hours.weekdays.includes(wd)
      && minutes >= hours.startHour * 60
      && minutes < hours.endHour * 60
      && cursor.getTime() > minStart
    ) {
      slots.push(cursor.toISOString());
    }
    cursor = new Date(cursor.getTime() + step);
    if (slots.length >= 500) break;
  }
  return slots;
}

module.exports = {
  COMMON_TIME_ZONES,
  isValidTimeZone,
  partsInZone,
  zonedLocalToUtc,
  weekdayFromYmd,
  dayKeyFromParts,
  normalizeBookingHours,
  slotRange
};
