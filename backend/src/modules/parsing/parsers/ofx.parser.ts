import * as fs from 'node:fs';
import { type BankName, FileType } from '../../../entities/statement.entity';
import { decodeUnlabelledText } from '../helpers/text-encoding.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';
import { parseOfx } from './statement-formats.util';

/** File-backed wrapper over the pure `parseOfx`; the format itself is detected at upload. */
export class OfxParser extends BaseParser {
  async canParse(_bankName: BankName, fileType: FileType): Promise<boolean> {
    return fileType === FileType.OFX;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    // Often Windows-1252 rather than UTF-8: decoded by what the bytes are.
    const text = cachedText ?? decodeUnlabelledText(await fs.promises.readFile(filePath));
    return parseOfx(text);
  }
}
