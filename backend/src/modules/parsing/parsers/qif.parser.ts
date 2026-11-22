import * as fs from 'node:fs';
import { type BankName, FileType } from '../../../entities/statement.entity';
import { decodeUnlabelledText } from '../helpers/text-encoding.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';
import { parseQif } from './qif-format.util';

/** File-backed wrapper over the pure `parseQif`; the format itself is detected at upload. */
export class QifParser extends BaseParser {
  async canParse(_bankName: BankName, fileType: FileType): Promise<boolean> {
    return fileType === FileType.QIF;
  }

  /** QIF states no encoding: older programs write Windows-1251 or -1252 rather than UTF-8. */
  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? decodeUnlabelledText(await fs.promises.readFile(filePath));
    return parseQif(text);
  }
}
