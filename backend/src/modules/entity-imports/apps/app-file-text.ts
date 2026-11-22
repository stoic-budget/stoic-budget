/**
 * Turning an exported file into rows: the bytes into text, then CSV or TSV into
 * cells. YNAB writes a TSV for currencies with a decimal comma, Actual writes a
 * UTF-8 BOM, so neither the encoding nor the delimiter is assumed.
 */

/** UTF-16 when the file says so, UTF-8 when it decodes cleanly, Windows-1252 otherwise. */
export function decodeExport(buffer: Uint8Array): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  }
  const body =
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? buffer.subarray(3) : buffer;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    // A spreadsheet re-saved on Windows: Latin-1 with the € and quotes of 1252.
    return new TextDecoder('windows-1252').decode(body);
  }
}

const CANDIDATES = [',', '\t', ';'] as const;
export type Delimiter = (typeof CANDIDATES)[number];

/** The delimiter that splits the header line into the most cells, quotes respected. */
export function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>(CANDIDATES.map(item => [item, 0]));
  let quoted = false;
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted;
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    } else if (!quoted && counts.has(char as Delimiter)) {
      counts.set(char as Delimiter, (counts.get(char as Delimiter) ?? 0) + 1);
    }
  }
  let best: Delimiter = ',';
  for (const [delimiter, count] of counts) {
    if (count > (counts.get(best) ?? 0)) {
      best = delimiter;
    }
  }
  return best;
}

/** RFC 4180 with any delimiter: quoted cells keep delimiters, newlines and `""`. Blank rows go. */
export function splitDelimited(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endRow = () => {
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) {
      rows.push(row);
    }
    row = [];
    field = '';
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    endRow();
  }
  return rows;
}

export interface ExportTable {
  delimiter: Delimiter;
  /** Header cells, trimmed; a BOM left on the first one is dropped. */
  headers: string[];
  rows: string[][];
}

export function readExportTable(buffer: Uint8Array): ExportTable {
  const text = decodeExport(buffer).replace(/^﻿/, '');
  const delimiter = detectDelimiter(text);
  const [header = [], ...rows] = splitDelimited(text, delimiter);
  return { delimiter, headers: header.map(cell => cell.replace(/^﻿/, '').trim()), rows };
}
