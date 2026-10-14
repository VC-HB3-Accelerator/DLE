'use strict';

/**
 * Fixed 8-slot angle recipe for listing photo pools.
 * Slot index 0 → 01.jpg … index 7 → 08.jpg.
 */
const POOL_ANGLE_SLOTS = [
  {
    angle: 'front_mild_diagonal',
    queryRu: 'вид спереди три четверти фото',
    queryEn: 'front three quarter photo',
  },
  {
    angle: 'rear_mild_diagonal',
    queryRu: 'вид сзади три четверти фото',
    queryEn: 'rear three quarter photo',
  },
  {
    angle: 'side',
    queryRu: 'вид сбоку профиль фото',
    queryEn: 'side profile photo',
  },
  {
    angle: 'cabin_dashboard',
    queryRu: 'салон кабина интерьер руль фото',
    queryEn: 'cabin interior dashboard photo',
  },
  {
    angle: 'front',
    queryRu: 'вид строго спереди фото',
    queryEn: 'front straight-on photo',
  },
  {
    angle: 'alt_mild_diagonal',
    queryRu: 'другой ракурс спереди фото',
    queryEn: 'alternate front angle photo',
  },
  {
    angle: 'detail_panel',
    queryRu: 'деталь кузова крупный план фото',
    queryEn: 'body panel detail close-up photo',
  },
  {
    angle: 'context_site',
    queryRu: 'на площадке в работе фото',
    queryEn: 'at work site yard photo',
  },
];

function slotFileName(index) {
  return `${String(index + 1).padStart(2, '0')}.jpg`;
}

function angleForFile(file) {
  const m = String(file || '').match(/^(\d{2})\.jpe?g$/i);
  if (!m) return null;
  const idx = Number(m[1]) - 1;
  return POOL_ANGLE_SLOTS[idx]?.angle || null;
}

function slotIndexForFile(file) {
  const m = String(file || '').match(/^(\d{2})\.jpe?g$/i);
  if (!m) return -1;
  return Number(m[1]) - 1;
}

module.exports = {
  POOL_ANGLE_SLOTS,
  slotFileName,
  angleForFile,
  slotIndexForFile,
};
