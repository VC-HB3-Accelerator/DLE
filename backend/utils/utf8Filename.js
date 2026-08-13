/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Multer/busboy часто отдаёт originalname как Latin-1 байты UTF-8 → «Ð¼Ð¸Ð½ÑƒÑ‚».
 * Чинним только явный mojibake; уже корректную кириллицу не трогаем.
 */

function fixUtf8Filename(name) {
  const s = String(name || '');
  if (!s) return s;
  // Уже нормальный UTF-8 с кириллицей
  if (/[А-Яа-яЁё]/.test(s)) return s;
  // Типичный mojibake UTF-8→Latin-1: Ð / Ñ
  if (!/Ð.|Ñ./.test(s)) return s;
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8');
    if (fixed.includes('\uFFFD')) return s;
    if (/[А-Яа-яЁё]/.test(fixed)) return fixed;
  } catch (_) {
    /* keep original */
  }
  return s;
}

function fixMulterFile(file) {
  if (!file) return file;
  if (file.originalname) {
    file.originalname = fixUtf8Filename(file.originalname);
  }
  return file;
}

module.exports = {
  fixUtf8Filename,
  fixMulterFile,
};
