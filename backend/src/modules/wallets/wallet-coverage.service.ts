import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { WalletCoverage } from '../../contracts';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { onlyBankStatements } from './bank-statements';
import { normalizeAccountNumber } from './wallet-account-match';
import { toDateOnly } from './wallet-ledger';
import { WalletsService } from './wallets.service';

type CoverageRow = WalletCoverage['rows'][number];

/** Characters of an account number a page may show. */
const TAIL_LENGTH = 4;

/** Rows that arrive as a statement without coming from a bank: a converted table, another app's export. */
const NOT_FROM_A_BANK = ['custom-table-conversion', 'entity-import'];

const laterOf = (a: string | null, b: string | null): string | null =>
  a && b ? (a > b ? a : b) : (a ?? b);

/**
 * How far each bank account's statements reach, for the dashboard's data
 * freshness card: every active account fed by bank statements, with its
 * balance check and rows in Review, and every bank whose statements no account
 * holds yet, grouped by bank and account number.
 */
@Injectable()
export class WalletCoverageService {
  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    private readonly wallets: WalletsService,
  ) {}

  async coverage(workspaceId: string): Promise<WalletCoverage> {
    const [groups, accounts] = await Promise.all([
      onlyBankStatements(
        this.statementRepository
          .createQueryBuilder('statement')
          .leftJoin(
            Transaction,
            'waiting',
            'waiting.statementId = statement.id AND waiting.isVerified = false AND waiting.isDuplicate = false AND waiting.isPending = false',
          )
          .select('statement.walletId', 'walletId')
          .addSelect('statement.bankName', 'bankName')
          .addSelect('statement.accountNumber', 'accountNumber')
          .addSelect('MAX(statement.statementDateTo)', 'dataTo')
          .addSelect('COUNT(waiting.id)', 'pendingReview')
          .where('statement.workspaceId = :workspaceId', { workspaceId }),
      )
        // Put on an account, they are that account's data; on their own, no bank's.
        .andWhere(
          "(statement.walletId IS NOT NULL OR COALESCE(statement.parsingDetails ->> 'detectedBy', '') NOT IN (:...notFromABank))",
          { notFromABank: NOT_FROM_A_BANK },
        )
        .groupBy('statement.walletId')
        .addGroupBy('statement.bankName')
        .addGroupBy('statement.accountNumber')
        .getRawMany<{
          walletId: string | null;
          bankName: string | null;
          accountNumber: string | null;
          dataTo: string | Date | null;
          pendingReview: string;
        }>(),
      this.wallets.list(workspaceId),
    ]);

    const dataToByWallet = new Map<string, string | null>();
    // The bank its statements name, for an account whose own bank was left blank.
    const bankByWallet = new Map<string, string | null>();
    const banks = new Map<string, CoverageRow>();
    for (const group of groups) {
      const dataTo = toDateOnly(group.dataTo);
      if (group.walletId) {
        dataToByWallet.set(
          group.walletId,
          laterOf(dataToByWallet.get(group.walletId) ?? null, dataTo),
        );
        bankByWallet.set(group.walletId, bankByWallet.get(group.walletId) ?? group.bankName);
        continue;
      }
      // "DE00 0000 01" and "de00000001" are one account of one bank.
      const key = `${group.bankName ?? ''}|${normalizeAccountNumber(group.accountNumber)}`;
      const number = normalizeAccountNumber(group.accountNumber);
      const bank = banks.get(key) ?? {
        kind: 'bank' as const,
        walletId: null,
        name: null,
        bankName: group.bankName,
        accountTail: number ? number.slice(-TAIL_LENGTH) : null,
        dataTo: null,
        pendingReview: 0,
        currency: null,
        reconciliation: null,
      };
      bank.dataTo = laterOf(bank.dataTo, dataTo);
      bank.pendingReview += Number(group.pendingReview) || 0;
      banks.set(key, bank);
    }

    const accountRows: CoverageRow[] = accounts
      .filter(account => account.isActive && dataToByWallet.has(account.id))
      .map(account => ({
        kind: 'account',
        walletId: account.id,
        name: account.name,
        bankName: account.bankName || (bankByWallet.get(account.id) ?? null),
        accountTail: null,
        dataTo: dataToByWallet.get(account.id) ?? null,
        pendingReview: account.pendingReviewCount,
        currency: account.currency,
        reconciliation: account.reconciliation,
      }));
    return { rows: [...accountRows, ...banks.values()] };
  }
}
