import { BadRequestException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import type { WalletType } from '../../entities/wallet.entity';

/**
 * What a write does to an account's credit limit, given the type the account
 * ends up with. Only a credit card keeps one: a limit sent for any other type
 * is refused, and an account that is not (or no longer) a card has it cleared.
 * `undefined` in the request leaves a card's limit as it was.
 */
export function creditLimitPatch(
  type: WalletType,
  requested: number | null | undefined,
): { creditLimit?: string | null } {
  if (type !== 'credit_card') {
    if (requested != null) {
      throw new BadRequestException(appError('WALLET_CREDIT_LIMIT_CARD_ONLY'));
    }
    return { creditLimit: null };
  }
  return requested === undefined
    ? {}
    : { creditLimit: requested === null ? null : String(requested) };
}

/** The database check behind the rule: only a credit card holds a limit. */
const CARD_ONLY_CHECK = 'CHK_wallets_credit_limit_card_only';

/**
 * A write that lost a race to a type change (a new limit landing on an account
 * another request just made a current account) trips the check: answer it as
 * the same refusal the rule gives, not as a 500.
 */
export function refuseCardOnlyViolation(error: unknown): never {
  const driverError = error instanceof QueryFailedError ? error.driverError : undefined;
  const { code, constraint } = (driverError ?? {}) as { code?: string; constraint?: string };
  if (code === '23514' && constraint === CARD_ONLY_CHECK) {
    throw new BadRequestException(appError('WALLET_CREDIT_LIMIT_CARD_ONLY'));
  }
  throw error;
}
