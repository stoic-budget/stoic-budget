import {
  type CustomTableColumn,
  CustomTableColumnType,
} from '../../../entities/custom-table-column.entity';

// Custom tables have no fixed schema: a report guesses which column is the
// date, amount, category and counterparty from each column's type and title.

export function scoreDateColumn(col: CustomTableColumn): number {
  const title = (col.title || '').toLowerCase();
  let score = 0;
  if (col.type === CustomTableColumnType.DATE) {
    score += 6;
  }
  if (/(^|[\s_])date([\s_]|$)/.test(title) || title.includes('дата')) {
    score += 4;
  }
  if (title.includes('год') || title.includes('year')) {
    score += 1;
  }
  if (title.includes('месяц') || title.includes('month')) {
    score += 1;
  }
  return score;
}

export function scoreAmountColumn(col: CustomTableColumn): number {
  const title = (col.title || '').toLowerCase();
  let score = 0;
  if (col.type === CustomTableColumnType.NUMBER) {
    score += 6;
  }
  if (
    title.includes('сумм') ||
    title.includes('amount') ||
    title.includes('итог') ||
    title.includes('total')
  ) {
    score += 4;
  }
  if (title.includes('приход') || title.includes('доход')) {
    score += 2;
  }
  if (title.includes('расход')) {
    score += 2;
  }
  if (title.includes('год') || title.includes('year')) {
    score -= 4;
  }
  if (title.includes('мсц') || title.includes('месяц') || title.includes('month')) {
    score -= 3;
  }
  if (title.includes('курс') || title.includes('rate') || title.includes('обмен')) {
    score -= 4;
  }
  if (title.includes('валют') || title.includes('currency')) {
    score -= 3;
  }
  return score;
}

export function scoreCategoryColumn(col: CustomTableColumn): number {
  const title = (col.title || '').toLowerCase();
  let score = 0;
  if (title.includes('катег') || title.includes('category')) {
    score += 6;
  }
  if (title.includes('статья') || title.includes('article')) {
    score += 5;
  }
  if (title.includes('группа') || title.includes('group')) {
    score += 2;
  }
  return score;
}

export function scoreCounterpartyColumn(col: CustomTableColumn): number {
  const title = (col.title || '').toLowerCase();
  let score = 0;
  if (title.includes('контраг') || title.includes('counterparty')) {
    score += 6;
  }
  if (title.includes('постав') || title.includes('supplier')) {
    score += 4;
  }
  if (title.includes('клиент') || title.includes('customer')) {
    score += 4;
  }
  if (title.includes('merchant') || title.includes('получател') || title.includes('платель')) {
    score += 4;
  }
  if (title.includes('кошел') || title.includes('wallet')) {
    score -= 2;
  }
  if (title.includes('филиал') || title.includes('branch')) {
    score -= 2;
  }
  return score;
}

export function pickBestColumnKey(
  columns: CustomTableColumn[],
  scorer: (col: CustomTableColumn) => number,
): string | null {
  let best: CustomTableColumn | null = null;
  let bestScore = 0;
  for (const col of columns) {
    const score = scorer(col);
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return best ? best.key : null;
}

/** Which column of a custom table holds each value a report reads. */
export interface ColumnMapping {
  dateKey: string | null;
  amountKey: string | null;
  categoryKey: string | null;
  counterpartyKey: string | null;
}

export function columnMappingOf(cols: CustomTableColumn[]): ColumnMapping {
  return {
    dateKey: pickBestColumnKey(cols, c => scoreDateColumn(c)),
    amountKey: pickBestColumnKey(cols, c => scoreAmountColumn(c)),
    categoryKey: pickBestColumnKey(cols, c => scoreCategoryColumn(c)),
    counterpartyKey: pickBestColumnKey(cols, c => scoreCounterpartyColumn(c)),
  };
}
