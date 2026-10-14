/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Разбор .xlsx (Open XML) без отдельной библиотеки Excel.
 * Старый .xls не читаем. Только первый лист, до MAX строк/колонок.
 */

const AdmZip = require('adm-zip');

const MAX_ROWS = 200;
const MAX_COLS = 40;

function decodeXml(raw) {
  return String(raw || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function isZip(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B;
}

function colIndex(letters) {
  let n = 0;
  for (const ch of String(letters || '').toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return -1;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function cellRef(ref) {
  const match = String(ref || '').match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  return { col: colIndex(match[1]), row: Number(match[2]) - 1 };
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const blocks = String(xml).match(/<si\b[\s\S]*?<\/si>/gi) || [];
  return blocks.map((block) => {
    const parts = [...block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => decodeXml(m[1]));
    return parts.join('');
  });
}

function cellValue(cellXml, shared) {
  const type = / t="([^"]+)"/.exec(cellXml)?.[1] || '';
  if (type === 'inlineStr') {
    const text = [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((m) => decodeXml(m[1])).join('');
    return text;
  }
  const raw = /<v>([\s\S]*?)<\/v>/i.exec(cellXml)?.[1];
  if (raw == null) return '';
  if (type === 's') return shared[Number(raw)] || '';
  if (type === 'b') return Number(raw) === 1 ? '1' : '0';
  return decodeXml(raw);
}

function parseSheet(xml, shared) {
  const grid = [];
  const cells = String(xml || '').match(/<c\b[^>]*>[\s\S]*?<\/c>|<c\b[^>]*\/>/gi) || [];
  let maxCol = -1;
  let maxRow = -1;
  for (const cell of cells) {
    const ref = / r="([^"]+)"/.exec(cell)?.[1];
    const pos = cellRef(ref);
    if (!pos || pos.col < 0 || pos.row < 0 || pos.col >= MAX_COLS || pos.row >= MAX_ROWS) continue;
    const value = cellValue(cell, shared);
    if (!grid[pos.row]) grid[pos.row] = [];
    grid[pos.row][pos.col] = value;
    if (pos.col > maxCol) maxCol = pos.col;
    if (pos.row > maxRow) maxRow = pos.row;
  }
  return { grid, maxCol, maxRow };
}

function firstSheetXml(zip) {
  const entries = zip.getEntries().filter((entry) => /xl\/worksheets\/sheet\d+\.xml$/i.test(entry.entryName));
  entries.sort((a, b) => a.entryName.localeCompare(b.entryName));
  if (!entries[0]) return '';
  return zip.readAsText(entries[0]);
}

function gridToTable(grid, maxCol, maxRow) {
  if (maxCol < 0 || maxRow < 0) return { columns: [], rows: [] };
  const headerRow = grid[0] || [];
  const columns = [];
  for (let i = 0; i <= maxCol; i += 1) {
    const name = String(headerRow[i] || '').trim() || `col_${i + 1}`;
    columns.push(name.slice(0, 80));
  }
  const rows = [];
  for (let r = 1; r <= maxRow; r += 1) {
    const line = grid[r] || [];
    const cells = {};
    let empty = true;
    columns.forEach((col, i) => {
      const value = line[i] == null ? '' : String(line[i]);
      cells[col] = value;
      if (value.trim()) empty = false;
    });
    if (!empty) rows.push(cells);
  }
  return { columns, rows };
}

function parseXlsx(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!isZip(buf)) {
    return { ok: false, error: 'XLS_NOT_XLSX', columns: [], rows: [] };
  }
  let zip;
  try {
    zip = new AdmZip(buf);
  } catch {
    return { ok: false, error: 'XLSX_BAD_ZIP', columns: [], rows: [] };
  }
  let sharedXml = '';
  try { sharedXml = zip.readAsText('xl/sharedStrings.xml') || ''; } catch { sharedXml = ''; }
  const shared = parseSharedStrings(sharedXml);
  let sheet = '';
  try { sheet = firstSheetXml(zip); } catch { sheet = ''; }
  if (!sheet) return { ok: false, error: 'XLSX_NO_SHEET', columns: [], rows: [] };
  const { grid, maxCol, maxRow } = parseSheet(sheet, shared);
  const table = gridToTable(grid, maxCol, maxRow);
  return { ok: Boolean(table.columns.length), error: null, ...table };
}

module.exports = {
  MAX_ROWS,
  MAX_COLS,
  isZip,
  parseXlsx,
};
