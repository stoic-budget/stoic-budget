import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { appError } from '../../../common/errors/app-error';
import { assertFound } from '../../../common/utils/assert-found.util';
import type {
  PropertyDebtOptions,
  PropertyDetails,
  PropertyKind,
  UpdatePropertyBody,
} from '../../../contracts';
import {
  ActorType,
  AuditAction,
  BalanceAccount,
  BalanceAccountType,
  EntityType,
  Transaction,
  Wallet,
} from '../../../entities';
import { AuditService } from '../../audit/audit.service';
import type { CurrencyAmounts } from '../../exchange-rates/currency-converter';
import { balanceAccountName } from '../balance-account-name';
import { negateSeries, walletCashSeries } from '../balance-cash-series';
import { attributesFor, propertyKindOf } from './property-kind';

/** A loan account linked to a property: its name, and what it owes (null once closed). */
export interface LinkedWalletDebt {
  name: string;
  owed: CurrencyAmounts | null;
}

type DebtPatch = Pick<BalanceAccount, 'debtWalletId' | 'debtAccountId'>;

/** Only loans buy flats and cars; a card or a savings account is not what a property is owed on. */
const LOAN_TYPE = 'loan';

const isUniqueViolation = (error: unknown): boolean =>
  ((error as { driverError?: { code?: string } })?.driverError?.code ??
    (error as { code?: string })?.code) === '23505';

/**
 * The details of the real estate and vehicle lines of the balance sheet:
 * what each one is, the debt it was bought with, and how fast a car loses
 * value. The figures built from them are the net worth page's.
 */
@Injectable()
export class BalancePropertyService {
  constructor(
    @InjectRepository(BalanceAccount) private readonly accounts: Repository<BalanceAccount>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(Transaction) private readonly transactions: Repository<Transaction>,
    private readonly auditService: AuditService,
  ) {}

  /** Loan accounts and the debt lines of the sheet, each with the property it is linked to. */
  async debtOptions(workspaceId: string, locale?: string): Promise<PropertyDebtOptions> {
    const [accounts, loans] = await Promise.all([
      this.accounts.find({ where: { workspaceId }, order: { position: 'ASC' } }),
      this.wallets.find({
        where: { workspaceId, type: LOAN_TYPE, isActive: true },
        select: { id: true, name: true },
        order: { name: 'ASC' },
      }),
    ]);
    const linkedTo = new Map<string, string>();
    for (const account of accounts) {
      const debt = account.debtWalletId ?? account.debtAccountId;
      if (debt) linkedTo.set(debt, account.id);
    }
    return {
      options: [
        ...loans.map(wallet => ({
          kind: 'wallet' as const,
          id: wallet.id,
          name: wallet.name,
          linkedTo: linkedTo.get(wallet.id) ?? null,
        })),
        ...accounts
          .filter(account => isDebtLine(account, accounts))
          .map(account => ({
            kind: 'liability' as const,
            id: account.id,
            name: balanceAccountName(account, locale),
            linkedTo: linkedTo.get(account.id) ?? null,
          })),
      ],
    };
  }

  async update(
    userId: string,
    workspaceId: string,
    accountId: string,
    body: UpdatePropertyBody,
  ): Promise<PropertyDetails> {
    const accounts = await this.accounts.find({ where: { workspaceId } });
    const account = accounts.find(item => item.id === accountId);
    if (!account) throw new NotFoundException(appError('BALANCE_ACCOUNT_NOT_FOUND'));
    const kind = propertyKindOf(account, accounts);
    if (!kind) throw new BadRequestException(appError('BALANCE_NOT_PROPERTY'));

    const patch: Pick<
      Partial<BalanceAccount>,
      'attributes' | 'depreciationRate' | 'debtWalletId' | 'debtAccountId'
    > = {};
    if (body.attributes !== undefined) {
      const attributes = attributesFor(kind, body.attributes);
      if (attributes === undefined) {
        throw new BadRequestException(appError('BALANCE_PROPERTY_DETAILS_INVALID'));
      }
      patch.attributes = attributes;
    }
    if (body.depreciationRate !== undefined) {
      if (body.depreciationRate !== null && kind !== 'vehicle') {
        throw new BadRequestException(appError('BALANCE_PROPERTY_DETAILS_INVALID'));
      }
      patch.depreciationRate =
        body.depreciationRate === null ? null : String(body.depreciationRate);
    }
    if (body.debt !== undefined) {
      Object.assign(patch, await this.debtPatch(workspaceId, account, accounts, body.debt));
    }

    const before = detailsOf(account, kind);
    if (Object.keys(patch).length > 0) {
      await this.accounts
        .update({ id: account.id, workspaceId }, patch as QueryDeepPartialEntity<BalanceAccount>)
        .catch((error: unknown) => {
          // Two properties linked to the same debt at once: the index lets one through.
          if (isUniqueViolation(error)) {
            throw new ConflictException(appError('BALANCE_PROPERTY_DEBT_TAKEN'));
          }
          throw error;
        });
      Object.assign(account, patch);
    }
    const after = detailsOf(account, kind);
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UPDATE,
      meta: { kind: 'balance_property', accountId: account.id, accountCode: account.code },
      diff: { before, after },
    });
    return after;
  }

  /**
   * The loan accounts among `walletIds` that belong to the workspace, each
   * with what it owes on `date` per currency. A closed account owes nothing
   * here, as it counts for nothing in net worth.
   */
  async linkedWalletDebts(
    workspaceId: string,
    walletIds: string[],
    date: string,
  ): Promise<Map<string, LinkedWalletDebt>> {
    const result = new Map<string, LinkedWalletDebt>();
    if (walletIds.length === 0) return result;
    const wallets = await this.wallets.find({
      where: { id: In(walletIds), workspaceId },
      select: { id: true, name: true, isActive: true, initialBalance: true, currency: true },
    });
    for (const wallet of wallets) {
      const owed = wallet.isActive
        ? (negateSeries(
            await walletCashSeries(this.transactions, workspaceId, [wallet], [date]),
          ).get(date) ?? new Map())
        : null;
      result.set(wallet.id, { name: wallet.name, owed });
    }
    return result;
  }

  private async debtPatch(
    workspaceId: string,
    account: BalanceAccount,
    accounts: BalanceAccount[],
    debt: UpdatePropertyBody['debt'],
  ): Promise<DebtPatch> {
    if (!debt) return { debtWalletId: null, debtAccountId: null };
    if (debt.kind === 'wallet') {
      const wallet = await this.wallets.findOne({
        where: { id: debt.id, workspaceId },
        select: { id: true, type: true },
      });
      assertFound(wallet, 'Wallet');
      if (wallet.type !== LOAN_TYPE) {
        throw new BadRequestException(appError('BALANCE_PROPERTY_DEBT_INVALID'));
      }
    } else {
      const line = accounts.find(item => item.id === debt.id);
      if (!line) throw new NotFoundException(appError('BALANCE_ACCOUNT_NOT_FOUND'));
      if (!isDebtLine(line, accounts)) {
        throw new BadRequestException(appError('BALANCE_PROPERTY_DEBT_INVALID'));
      }
    }
    const column = debt.kind === 'wallet' ? 'debtWalletId' : 'debtAccountId';
    const taken = await this.accounts.exists({
      where: { workspaceId, [column]: debt.id, id: Not(account.id) },
    });
    if (taken) {
      throw new ConflictException(appError('BALANCE_PROPERTY_DEBT_TAKEN'));
    }
    return debt.kind === 'wallet'
      ? { debtWalletId: debt.id, debtAccountId: null }
      : { debtWalletId: null, debtAccountId: debt.id };
  }
}

/** A debt line someone types a value into: a liability that is not worked out from the accounts. */
function isDebtLine(account: BalanceAccount, accounts: readonly BalanceAccount[]): boolean {
  return (
    account.accountType === BalanceAccountType.LIABILITY &&
    !account.isAutoComputed &&
    !accounts.some(other => other.parentId === account.id)
  );
}

function detailsOf(account: BalanceAccount, kind: PropertyKind): PropertyDetails {
  const debt = account.debtWalletId
    ? { kind: 'wallet' as const, id: account.debtWalletId }
    : account.debtAccountId
      ? { kind: 'liability' as const, id: account.debtAccountId }
      : null;
  return {
    accountId: account.id,
    kind,
    attributes: account.attributes as PropertyDetails['attributes'],
    debt,
    depreciationRate: account.depreciationRate === null ? null : Number(account.depreciationRate),
  };
}
