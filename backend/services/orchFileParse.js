/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * file.parse: CSV/TSV/xlsx/текст/простой PDF → колонки и строки на просмотр.
 * Содержимое недоверенное: не меняет права и режим.
 */

const INJECTION_KEYS = /^(tools_allow|run_mode|spawn_role|agent_id|system|prompt)$/i;
const MAX_ROWS = 200;
const MAX_COLS = 40;

function safeHeader(raw, idx) {
  const name = String(raw || '').trim() || `col_${idx + 1}`;
  if (INJECTION_KEYS.test(name)) return `col_${idx + 1}`;
  return name.slice(0, 80);
}

function detectKind({ filename, mime, text, buffer }) {
  const name = String(filename || '').toLowerCase();
  const type = String(mime || '').toLowerCase();
  if (/\.xlsx?$/.test(name) || /spreadsheet|excel/.test(type)) return 'xlsx';
  if (/\.pdf$/.test(name) || /pdf/.test(type)) return 'pdf';
  if (/\.tsv$/.test(name) || /tab-separated/.test(type)) return 'tsv';
  if (/\.csv$/.test(name) || /csv/.test(type)) return 'csv';
  if (buffer && buffer.length >= 5 && buffer.slice(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  const sample = String(text || '').slice(0, 200);
  if (sample.includes('\t') && sample.includes('\n')) return 'tsv';
  if (sample.includes(',') && sample.includes('\n')) return 'csv';
  return 'text';
}

function extractPdfText(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const latin = raw.toString('latin1');
  const chunks = [];
  const tj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match;
  while ((match = tj.exec(latin))) {
    chunks.push(match[1].replace(/\\n/g, '\n').replace(/\\(.)/g, '$1'));
  }
  const arr = /\[(.*?)\]\s*TJ/gs;
  while ((match = arr.exec(latin))) {
    const inner = String(match[1] || '');
    const parts = inner.match(/\(((?:\\.|[^\\)])*)\)/g) || [];
    chunks.push(parts.map((p) => p.slice(1, -1).replace(/\\(.)/g, '$1')).join(''));
  }
  return chunks.join(' ').replace(/[ \t]+/g, ' ').trim();
}

function loadCsvParse() {
  const path = require('path');
  const fs = require('fs');
  const candidates = [
    '/host-project/orchestrator/runtime/csv.js',
    path.join(__dirname, '../../orchestrator/runtime/csv.js'),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) throw new Error('orchestrator/runtime/csv.js not found');
  return require(file).parseCsv;
}

function rowsFromDelimited(text, delimiter) {
  const parseCsv = loadCsvParse();
  if (delimiter === ',') {
    const objects = parseCsv(text);
    if (!objects.length) return { columns: [], rows: [] };
    const columns = Object.keys(objects[0]).map((name, idx) => safeHeader(name, idx));
    const rows = objects.slice(0, MAX_ROWS).map((obj) => {
      const cells = {};
      columns.forEach((col, idx) => {
        const rawKey = Object.keys(obj)[idx];
        cells[col] = rawKey == null ? '' : String(obj[rawKey] ?? '');
      });
      return cells;
    });
    return { columns: columns.slice(0, MAX_COLS), rows };
  }
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { columns: [], rows: [] };
  const headers = lines[0].split(delimiter).map((h, idx) => safeHeader(h, idx)).slice(0, MAX_COLS);
  const rows = lines.slice(1, MAX_ROWS + 1).map((line) => {
    const parts = line.split(delimiter);
    const cells = {};
    headers.forEach((col, idx) => {
      cells[col] = String(parts[idx] || '').trim();
    });
    return cells;
  });
  return { columns: headers, rows };
}

function rowsFromText(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { columns: ['text'], rows: [] };
  return {
    columns: ['text'],
    rows: lines.slice(0, MAX_ROWS).map((line) => ({ text: line.slice(0, 2000) })),
  };
}

function parseOne({ text, buffer, filename, mime } = {}) {
  const kind = detectKind({ filename, mime, text, buffer });
  if (kind === 'xlsx') {
    const xlsx = require('./orchXlsx');
    const parsed = xlsx.parseXlsx(buffer);
    if (!parsed.ok) {
      return {
        trusted: false,
        kind,
        filename: filename || null,
        columns: [],
        rows: [],
        error: parsed.error || 'XLSX_EMPTY',
        questions: [{
          id: 'xlsx',
          field: 'file',
          text: parsed.error === 'XLS_NOT_XLSX'
            ? 'Это старый Excel (.xls). Сохраните как .xlsx и приложите снова.'
            : 'Не удалось разобрать лист Excel. Проверьте файл или приложите CSV.',
        }],
      };
    }
    return {
      trusted: false,
      kind,
      filename: filename || null,
      columns: parsed.columns,
      rows: parsed.rows,
      error: null,
      questions: parsed.rows.length ? [] : [{
        id: 'empty',
        field: 'file',
        text: 'В файле не видно строк. Поправьте файл или вставьте таблицу текстом.',
      }],
    };
  }
  let body = String(text || '');
  if (!body && buffer && kind === 'pdf') body = extractPdfText(buffer);
  else if (!body && buffer) body = Buffer.from(buffer).toString('utf8');
  const table = kind === 'csv'
    ? rowsFromDelimited(body, ',')
    : kind === 'tsv'
      ? rowsFromDelimited(body, '\t')
      : rowsFromText(body);
  return {
    trusted: false,
    kind,
    filename: filename || null,
    columns: table.columns,
    rows: table.rows,
    error: null,
    questions: table.rows.length ? [] : [{
      id: 'empty',
      field: 'file',
      text: 'В файле не видно строк. Поправьте файл или вставьте таблицу текстом.',
    }],
  };
}

function parse(input = {}) {
  const docs = Array.isArray(input.documents) && input.documents.length
    ? input.documents
    : [input];
  const parsed = docs.filter((doc) => doc && (doc.text || doc.buffer || doc.filename)).map(parseOne);
  if (!parsed.length) {
    return {
      trusted: false,
      kind: 'empty',
      filename: null,
      columns: [],
      rows: [],
      error: 'NO_FILE',
      questions: [{ id: 'file', field: 'file', text: 'Приложите Excel, CSV, текст или PDF.' }],
    };
  }
  return parsed[0];
}

module.exports = {
  INJECTION_KEYS,
  detectKind,
  extractPdfText,
  parse,
  parseOne,
};
