import type { PdfTextRow } from '../../../common/utils/pdf-parser.util';

/**
 * A page break printed as a line of its own ("Continued", "CONTINUED..."), which would
 * otherwise be read as the end of the description above it. Whole row only,
 * so a payee called "Continued Ltd" is kept.
 */
export function isPageFooterLine(row: PdfTextRow): boolean {
  const text = row.text.replace(/\s+/g, ' ').trim().toLowerCase();
  return text.replace(/(?:\.{3}|…)$/, '') === 'continued';
}
