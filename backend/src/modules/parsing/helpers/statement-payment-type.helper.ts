import type { PaymentType } from '../../../contracts/transactions/payment-type';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';

/**
 * A statement with the payment type each bank wording names put on its rows,
 * the other accounts of the file included. A row `typeOf` knows nothing about
 * is left as it is.
 */
export function withPaymentTypes(
  statement: ParsedStatement,
  typeOf: (paymentPurpose: string) => PaymentType | null,
): ParsedStatement {
  const typed = (rows: ParsedTransaction[]): ParsedTransaction[] =>
    rows.map(row => {
      const paymentType = typeOf(row.paymentPurpose);
      return paymentType ? { ...row, paymentType } : row;
    });
  return {
    ...statement,
    transactions: typed(statement.transactions),
    ...(statement.otherAccounts && {
      otherAccounts: statement.otherAccounts.map(account => ({
        ...account,
        transactions: typed(account.transactions),
      })),
    }),
  };
}
