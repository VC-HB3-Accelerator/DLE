/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

export function partsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'UTC',
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

export function dayKey(iso, timeZone) {
  const p = partsInZone(new Date(iso), timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Слот уже начался или время невалидно — бронировать нельзя. */
export function isPastSlot(iso) {
  if (iso == null || iso === '') return false;
  const raw = iso?.starts_at || iso;
  const ts = new Date(raw).getTime();
  return Number.isNaN(ts) || ts <= Date.now();
}

export function formatSlotTime(iso, timeZone) {
  const p = partsInZone(new Date(iso), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  let padDays = first.getUTCDay();
  padDays = padDays === 0 ? 6 : padDays - 1;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < padDays; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function groupSlotsByDay(slots, timeZone) {
  const map = new Map();
  for (const slot of slots || []) {
    const iso = slot.starts_at || slot;
    if (!iso) continue;
    const key = dayKey(iso, timeZone);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(iso);
  }
  return map;
}

export function monthBoundsIso(year, month) {
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 12 * 60 * 60 * 1000);
  const to = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function shiftDayKey(key, days) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function weekStartKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  return shiftDayKey(key, offset);
}

export function weekDayKeys(key) {
  const start = weekStartKey(key);
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(start, i));
}

export function weekBoundsIso(key) {
  const start = weekStartKey(key);
  const [y, m, d] = start.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 12 * 60 * 60 * 1000);
  const to = new Date(Date.UTC(y, m - 1, d + 7, 12, 0, 0));
  return { from: from.toISOString(), to: to.toISOString() };
}

export function shiftMonthParts(year, month, delta) {
  const dt = new Date(Date.UTC(year, month - 1 + Number(delta || 0), 1));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
}
