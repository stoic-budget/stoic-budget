import type { Mock } from 'vitest';
import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
  type PdfTextRow,
} from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { GenericPdfParser } from '@/modules/parsing/parsers/generic-pdf.parser';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({
      locale: 'unknown',
      confidence: 0,
      method: 'legacy',
      reason: 'mock',
    }),
  },
}));

vi.mock('@/common/utils/pdf-parser.util', () => ({
  extractTextFromPdf: vi.fn(),
  extractTablesFromPdf: vi.fn(),
  extractTextAndLayoutFromPdf: vi.fn().mockResolvedValue({ text: '', rows: [] }),
}));

describe('GenericPdfParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canParse', () => {
    it('accepts any PDF for an unrecognized bank', async () => {
      const parser = new GenericPdfParser();
      const result = await parser.canParse(BankName.OTHER, FileType.PDF, '/tmp/mock.pdf', 'text');

      expect(result).toBe(true);
    });
  });

  describe('parse', () => {
    it('preserves a legitimate zero opening balance instead of dropping it', async () => {
      const parser = new GenericPdfParser();
      const text = ['Statement', 'Остаток на начало 0,00', 'Остаток на конец 500,00'].join('\n');

      (extractTextFromPdf as Mock).mockResolvedValue(text);
      (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.metadata.balanceStart).toBe(0);
      expect(result.metadata.balanceEnd).toBe(500);
    });

    it('does not swallow an unrelated numeric line following the balance into the parsed value', async () => {
      const parser = new GenericPdfParser();
      // "1" directly below the balance, with no letters in between, is the
      // exact shape that used to defeat the old greedy [\d\s,.-]+ capture
      // (it happily spans newlines) — e.g. a lone page number.
      const text = [
        'Statement',
        'Остаток на начало 1 000,00',
        '1',
        'Остаток на конец 500,00',
      ].join('\n');

      (extractTextFromPdf as Mock).mockResolvedValue(text);
      (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.metadata.balanceStart).toBe(1000);
      expect(result.metadata.balanceEnd).toBe(500);
    });

    it('takes the period from the dated balance lines, not from the first and last rows', async () => {
      const parser = new GenericPdfParser();
      const text = [
        'Beginning Balance on December 16, 2020 $ 200.00',
        'Ending Balance on January 15, 2021 $ 190.00',
      ].join('\n');
      const line = (y: number, words: [string, number][]): PdfTextRow => ({
        page: 1,
        y,
        text: words.map(([word]) => word).join(' '),
        items: words.map(([word, x]) => ({ text: word, x, y, width: word.length * 5, height: 10, page: 1 })),
      });
      (extractTextFromPdf as Mock).mockResolvedValue(text);
      (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });
      (extractTextAndLayoutFromPdf as Mock).mockResolvedValue({
        text,
        rows: [
          line(100, [['Date', 50], ['Description', 120], ['Amount', 400]]),
          line(120, [['12/21/2020', 50], ['ACME', 120], ['Store', 150], ['-10.00', 400]]),
        ],
      });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.transactions).toHaveLength(1);
      expect(result.metadata.dateFrom).toEqual(new Date(2020, 11, 16));
      expect(result.metadata.dateTo).toEqual(new Date(2021, 0, 15));
    });
  });
});
