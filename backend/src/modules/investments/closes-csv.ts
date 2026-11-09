import type { ImportCloseSkipReason } from '../../contracts';
import { detectDateOrder, parseImportDate } from '../entity-imports/helpers/import-values';

export interface CsvClose {
  line: number;
  date: string;
  close: number;
}

export interface ParsedCloses {
  rows: CsvClose[];
  skipped: Array<{ line: number; reason: ImportCloseSkipReason }>;
}

/** Header names that say which column is the date and which the close. */
const DATE_HEADER = /^(date|day|datum|дата|fecha|data|tarih|päivä|dato|日付|日期)$/i;
const CLOSE_HEADER =
  /^(close|close price|closing price|price|last|kurs|schluss|schlusskurs|закрытие|цена|cierre|clôture|prix|chiusura|fechamento|kapanış|slot|stängning|luk|终值|收盘|終値)$/i;
/** Adjusted for dividends too: a different series, never read as the close. */
const ADJUSTED = /adj/i;

/**
 * The closes in the text of a CSV file: a date and a close per line, with or
 * without a header. With a header, the columns it names are read (Yahoo's
 * own download has `Date,Open,High,Low,Close,Adj Close,Volume`); without one,
 * the first column is the date and the second the close. Day/month order is
 * read from the whole column, numbers in either decimal style. A line dated
 * after `today`, or a second line for a day, is left out and said so.
 */
export function parseClosesCsv(text: string, today: string): ParsedCloses {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((raw, index) => ({ line: index + 1, raw }))
    .filter(entry => entry.raw.trim() !== '');
  if (lines.length === 0) return { rows: [], skipped: [] };

  const delimiter = pickDelimiter(lines[0].raw);
  const cells = lines.map(entry => ({ line: entry.line, values: splitLine(entry.raw, delimiter) }));
  const header = cells[0].values.map(value => value.trim());
  const named = {
    date: header.findIndex(name => DATE_HEADER.test(name)),
    close: header.findIndex(name => CLOSE_HEADER.test(name) && !ADJUSTED.test(name)),
  };
  const hasHeader = named.date >= 0 || named.close >= 0;
  const body = hasHeader ? cells.slice(1) : cells;
  const dateColumn = named.date >= 0 ? named.date : 0;
  const closeColumn = named.close >= 0 ? named.close : 1;
  const order = detectDateOrder(body.map(row => row.values[dateColumn] ?? ''));

  const result: ParsedCloses = { rows: [], skipped: [] };
  const seen = new Set<string>();
  for (const { line, values } of body) {
    const date = parseImportDate(values[dateColumn] ?? '', order);
    if (!date) {
      result.skipped.push({ line, reason: 'unreadable_date' });
      continue;
    }
    const read = readNumber(values[closeColumn] ?? '', delimiter);
    // Eight decimals, as stored: a close that rounds to nothing is no close.
    const value = read === null ? null : Math.round(read * 1e8) / 1e8;
    if (value === null || !(value > 0) || value >= 1e12) {
      result.skipped.push({ line, reason: 'unreadable_close' });
      continue;
    }
    if (date > today) {
      result.skipped.push({ line, reason: 'future_date' });
      continue;
    }
    if (seen.has(date)) {
      result.skipped.push({ line, reason: 'duplicate_date' });
      continue;
    }
    seen.add(date);
    result.rows.push({ line, date, close: value });
  }
  return result;
}

/**
 * A price in either decimal style. With both marks, the later one is the
 * decimal point (`1.234,56`, `1,234.56`). A lone comma is a decimal comma,
 * except in a comma-separated file where it stands before exactly three
 * digits (`"1,234"`): there it groups thousands.
 */
export function readNumber(raw: string, delimiter: string): number | null {
  const text = raw.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(text)) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  let plain: string;
  if (comma >= 0 && dot >= 0) {
    plain = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma >= 0) {
    const grouping = delimiter === ',' && /^-?\d{1,3}(,\d{3})+$/.test(text);
    plain = grouping ? text.replace(/,/g, '') : text.replace(/,/g, '.');
  } else {
    plain = text;
  }
  if (!/^-?\d*\.?\d+$/.test(plain)) return null;
  const value = Number(plain);
  return Number.isFinite(value) ? value : null;
}

/** The separator the first line uses most: a semicolon file keeps commas for decimals. */
function pickDelimiter(line: string): string {
  const counts = [';', '\t', ','].map(candidate => ({
    candidate,
    count: splitLine(line, candidate).length,
  }));
  return counts.reduce((best, next) => (next.count > best.count ? next : best)).candidate;
}

/** One line's fields; a field in double quotes may hold the separator and `""`. */
function splitLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}
