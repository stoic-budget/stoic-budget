import type { ParsedStatement } from '../interfaces/parsed-statement.interface';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Lloyds Banking Group statements (Lloyds, Halifax, Bank of Scotland) print
 * "Balance on <first day>" as the balance after a row of that day, not before
 * them: the summary's money in and out add up from the rows' own opening. A
 * printed opening that is the balance after one of the first day's rows is
 * that, not a misread: its check is dropped.
 */
export function firstDayBalanceLabel(statement: ParsedStatement): ParsedStatement {
  const { transactions, metadata } = statement;
  const first = transactions[0]?.transactionDate.getTime();
  let running = metadata.balanceStart ?? Number.NaN;
  const afterRows = new Set<number>();
  for (const row of transactions.filter(entry => entry.transactionDate.getTime() === first)) {
    running += (row.credit ?? 0) - (row.debit ?? 0);
    afterRows.add(round(running));
  }
  const checks = statement.checks?.filter(check => {
    const { side, expected } = check.detail ?? {};
    return !(
      check.code === 'printed_balances' &&
      !check.passed &&
      side === 'start' &&
      typeof expected === 'number' &&
      afterRows.has(round(expected))
    );
  });
  return checks ? { ...statement, checks } : statement;
}
