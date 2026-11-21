import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';
import { WalletType } from '../reference/reference';

/**
 * Cents at most, judged on the number as written: the shared
 * `isAtMostTwoDecimals` compares `value * 100` with a fixed tolerance, which
 * refuses some valid amounts above about 10^8 (149257142.61).
 */
const isCents = Schema.makeFilter<number>(value =>
  Number(value.toFixed(2)) === value ? undefined : 'Expected at most 2 decimal places',
);

/**
 * A credit card's limit in the account's currency: above zero, cents at most,
 * and below what a `decimal(15,2)` column holds.
 */
export const CreditLimit = Schema.Finite.check(
  isCents,
  Schema.isGreaterThan(0),
  Schema.isLessThan(10_000_000_000_000),
);

export const CreateWalletBody = Schema.Struct({
  name: Schema.String,
  type: optionalNullable(WalletType),
  accountNumber: optionalNullable(Schema.String),
  bankName: optionalNullable(Schema.String),
  currency: optionalNullable(Schema.String),
  initialBalance: optionalNullable(Schema.Finite),
  /**
   * Whose account this is in the household; `null` means shared. Transactions
   * imported into it start on the same person.
   */
  ownerMemberId: optionalNullable(Schema.String.check(Schema.isUUID())),
  /**
   * Credit cards only: any other type is refused with `WALLET_CREDIT_LIMIT_CARD_ONLY`,
   * and moving a card to another type clears it. `null` clears it.
   */
  creditLimit: optionalNullable(CreditLimit),
});
export type CreateWalletBody = Wire<typeof CreateWalletBody>;

/**
 * `POST /wallets`: an account, plus statements to move into it right away
 * (creating an account from statements found on the Accounts page).
 */
export const CreateWalletRequest = CreateWalletBody.mapFields(
  Struct.assign({
    statementIds: Schema.optional(Schema.Array(Schema.String.check(Schema.isUUID()))),
  }),
);
export type CreateWalletRequest = Wire<typeof CreateWalletRequest>;

/** `POST /wallets/:id/statements`: statements whose rows move into the account. */
export const AttachStatementsBody = Schema.Struct({
  statementIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type AttachStatementsBody = Wire<typeof AttachStatementsBody>;

export const UpdateWalletBody = CreateWalletBody.mapFields(Struct.map(optionalNullable)).mapFields(
  Struct.assign({
    isActive: optionalNullable(Schema.Boolean),
  }),
);
export type UpdateWalletBody = Wire<typeof UpdateWalletBody>;

/** `/wallets/:id`: a wallet's uuid. */
export const WalletParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type WalletParams = Wire<typeof WalletParams>;

/** `/wallets/:id/statements/:statementId`: an account and one of its statements. */
export const WalletStatementParams = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  statementId: Schema.String.check(Schema.isUUID()),
});
export type WalletStatementParams = Wire<typeof WalletStatementParams>;
