import csv = require('csv-parser');

import * as fs from 'fs';
import { Readable } from 'stream';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { type BankName, FileType } from '../../../entities/statement.entity';
import { detectDateOrder, parseNumericDate } from '../helpers/numeric-date.helper';
import { decodeUnlabelledText } from '../helpers/text-encoding.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BaseTabularParser } from './base-tabular.parser';
import { type CsvPreset, findCsvPreset, presetColumnMapping } from './csv-presets';

const HEADER_SCAN_ROWS = 40;
export class CsvParser extends BaseTabularParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    return fileType === FileType.CSV;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    // Detect currency from raw file content before streaming rows
    // Decoded once, whatever the bank saved it in (#637): UTF-16, 1251, 1252…
    const text = decodeUnlabelledText(fs.readFileSync(filePath));
    const rawContent = text.slice(0, 4096);
    const detectedCurrency = this.detectCurrency(rawContent) || appDefaultCurrency();

    const rows = await this.readRows(text);
    const { headerIndex, headers, preset, columnMapping } = this.locateHeader(rows);
    const dataRows = rows.slice(headerIndex + 1);

    // Day and month order is a property of the file, not of each row: decided
    // once from every date in the column, so "01/05" and "01/13" in one Chase
    // export are both read month-first.
    const dateIndex = columnMapping.date;
    const dateOrder =
      dateIndex === undefined
        ? 'dmy'
        : (detectDateOrder(dataRows.map(row => row[dateIndex] ?? '')) ??
          preset?.dateOrder ??
          'dmy');

    const transactions: ParsedTransaction[] = [];
    for (const row of dataRows) {
      const transaction = this.parseRow(
        row,
        columnMapping,
        index =>
          index === dateIndex
            ? (parseNumericDate(row[index] ?? '', dateOrder) ?? row[index])
            : row[index],
        preset ? `CSV:${preset.name}` : 'CSV',
        preset?.currency ?? detectedCurrency,
        preset?.unsignedAmountDirection ?? 'credit',
      );
      if (transaction) {
        transactions.push(transaction);
      }
    }

    // CSV exports rarely print the period, so it is the span of the rows.
    const times = transactions.map(transaction => transaction.transactionDate.getTime());
    const dateFrom = times.length ? new Date(Math.min(...times)) : new Date();
    const dateTo = times.length ? new Date(Math.max(...times)) : dateFrom;

    const headerText = headers.join(' ').trim();
    const normalizedHeader = this.normalizeHeader(headerText);
    const localeInfo = this.detectLocale(headerText);
    return {
      metadata: {
        accountNumber: 'Unknown',
        dateFrom,
        dateTo,
        currency: preset?.currency ?? detectedCurrency,
        institution: preset?.name,
        rawHeader: headerText || undefined,
        normalizedHeader: normalizedHeader || undefined,
        locale: localeInfo.locale !== 'unknown' ? localeInfo.locale : undefined,
      },
      transactions,
    };
  }

  private readRows(text: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const rows: string[][] = [];
      Readable.from([text])
        .pipe(csv({ separator: this.detectSeparator(text), headers: false }))
        .on('data', (row: Record<string, string>) => rows.push(Object.values(row)))
        .on('end', () => resolve(rows))
        .on('error', reject);
    });
  }

  /**
   * Many exports put account details, the period or a balance above the
   * transaction table (DKB, ING DE). The header is the first row matching a
   * known bank layout, else the row the generic guesser scores highest, else
   * the first row.
   */
  private locateHeader(rows: string[][]): {
    headerIndex: number;
    headers: string[];
    preset: CsvPreset | null;
    columnMapping: Record<string, number>;
  } {
    const normalize = (row: string[]) =>
      row.map(cell =>
        cell
          .replace(/^\uFEFF/, '')
          .toLowerCase()
          .trim(),
      );

    const scanned = rows.slice(0, HEADER_SCAN_ROWS);
    for (let index = 0; index < scanned.length; index++) {
      const headers = normalize(scanned[index]);
      const preset = findCsvPreset(headers);
      if (preset) {
        return {
          headerIndex: index,
          headers,
          preset,
          columnMapping: presetColumnMapping(preset, headers),
        };
      }
    }

    const guessed = this.findHeaderRow(scanned.map(normalize), HEADER_SCAN_ROWS);
    const headerIndex = guessed?.index ?? 0;
    const headers = normalize(rows[headerIndex] ?? []);
    return {
      headerIndex,
      headers,
      preset: null,
      columnMapping: guessed?.mapping ?? this.mapColumns(headers),
    };
  }

  private detectSeparator(content: string): string {
    // Vote over the first lines, not just the first: a preamble line such as
    // "Account statement" has no separator at all. The separator is on
    // (nearly) every line; ties go to ';' because comma-decimal files carry
    // commas inside amounts too.
    const lines = content
      .split(/\r?\n/)
      .filter(line => line.trim())
      .slice(0, 20);
    const candidates = [';', ',', '\t'];
    const votes = candidates.map(
      separator => lines.filter(line => line.includes(separator)).length,
    );
    const best = Math.max(...votes);
    return best > 0 ? candidates[votes.indexOf(best)] : ',';
  }
}
