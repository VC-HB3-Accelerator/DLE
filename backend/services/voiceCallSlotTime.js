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

function addCalendarDays(year, month, day, delta) {
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

function slotRange(settings, fromIso, toIso) {
  const hours = normalizeBookingHours(settings?.booking_hours);
  const tz = hours.timeZone;
  const stepMinutes = Math.max(10, Number(settings?.booking_slot_minutes) || 30);
  const step = stepMinutes * 60 * 1000;
  const from = fromIso ? new Date(fromIso) : new Date();
  const to = toIso ? new Date(toIso) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) {
    return [];
  }

  const minStart = Date.now() + 5 * 60 * 1000;
  const windowStart = Math.max(from.getTime(), minStart);
  if (windowStart >= to.getTime()) return [];

  const startParts = partsInZone(new Date(windowStart), tz);
  let ymd = { year: startParts.year, month: startParts.month, day: startParts.day };
  const slots = [];
  const end = to.getTime();

  // По дням (не тикаем 10‑мин шагом через уже прошедшие сутки — иначе guard «съедает» месяц).
  for (let dayGuard = 0; dayGuard < 93; dayGuard += 1) {
    const wd = weekdayFromYmd(ymd.year, ymd.month, ymd.day);
    if (hours.weekdays.includes(wd)) {
      let cursor = zonedLocalToUtc(tz, ymd.year, ymd.month, ymd.day, hours.startHour, 0);
      const dayEnd = zonedLocalToUtc(tz, ymd.year, ymd.month, ymd.day, hours.endHour, 0);
      if (cursor.getTime() < windowStart) {
        const extra = Math.ceil((windowStart - cursor.getTime()) / step);
        cursor = new Date(cursor.getTime() + extra * step);
      }
      while (cursor.getTime() < dayEnd.getTime() && cursor.getTime() < end) {
        if (cursor.getTime() >= windowStart) {
          const p = partsInZone(cursor, tz);
          const minutes = p.hour * 60 + p.minute;
          if (
            p.year === ymd.year
            && p.month === ymd.month
            && p.day === ymd.day
            && minutes >= hours.startHour * 60
            && minutes < hours.endHour * 60
          ) {
            slots.push(cursor.toISOString());
          }
        }
        cursor = new Date(cursor.getTime() + step);
      }
    }
    ymd = addCalendarDays(ymd.year, ymd.month, ymd.day, 1);
    const dayStartUtc = zonedLocalToUtc(tz, ymd.year, ymd.month, ymd.day, 0, 0);
    if (dayStartUtc.getTime() >= end) break;
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
