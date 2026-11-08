import { Injectable } from '@nestjs/common';
// A value import: Nest reads the constructor's parameter types from metadata.
import { DataSource } from 'typeorm';
import type { SplitPartInput } from '../../../contracts';
import { Category, CategoryType } from '../../../entities/category.entity';
import type { Statement } from '../../../entities/statement.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../../entities/transaction.entity';
import { UNCATEGORIZED_CATEGORY_NAME } from '../../categories/uncategorized-category';
import { hasDecidedCategory } from '../../classification/engine/category-decision';
import { ClassificationService } from '../../classification/services/classification.service';
import { categoryByName } from '../../entity-imports/helpers/category-by-name';
import { TransactionsService } from '../../transactions/transactions.service';
import type { ParsedSplit, ParsedTransaction } from '../interfaces/parsed-statement.interface';

type Log = (level: string, message: string) => void;

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Where the file says the money went, kept on the row as `[Account]` (QIF's own
 * notation) so pairing can tell which of two equal transfers is this one's.
 */
export function transferHint(parsed: Pick<ParsedTransaction, 'transferAccount'>): string | null {
  return parsed.transferAccount ? `[${parsed.transferAccount}]` : null;
}

/**
 * What a statement file says about its rows beyond the bank's columns: the
 * category the user filed a row under in the program that exported it, and
 * the parts it split a row into (QIF does both).
 */
@Injectable()
export class StatementRowHintsService {
  constructor(
    private readonly classificationService: ClassificationService,
    private readonly transactionsService: TransactionsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Classifies a row as every statement row is, then lets the file's category
   * stand where no rule decided one. A user who asked to pick every category
   * by hand gets none at all.
   */
  async classify(
    row: Transaction,
    userId: string,
    parsed: ParsedTransaction,
    manualSelection: boolean,
  ): Promise<Partial<Transaction>> {
    const classification = await this.classificationService.classifyTransaction(row, userId);
    if (manualSelection) {
      classification.categoryId = undefined;
      classification.categorySource = null;
      classification.categoryReason = null;
      return classification;
    }
    const decided = hasDecidedCategory({
      categoryId: classification.categoryId ?? null,
      categorySource: classification.categorySource ?? null,
    });
    if (parsed.categoryName && !decided) {
      const categoryId = await this.fileCategory(row, userId, parsed.categoryName);
      if (categoryId) {
        // The user's own filing in the program the file came from.
        classification.categoryId = categoryId;
        classification.categorySource = TransactionCategorySource.MANUAL;
        classification.categoryReason = null;
      }
    }
    return classification;
  }

  /**
   * Splits the saved rows the file split, the way a person splitting them by
   * hand would (`TransactionsService.split`), and answers the rows with each
   * split one replaced by its parts. A row that cannot be split stays whole
   * and the log says why; a duplicate is not split again.
   */
  async applySplits(
    statement: Statement,
    saved: Transaction[],
    parsed: ParsedTransaction[],
    log: Log,
  ): Promise<Transaction[]> {
    const rows: Transaction[] = [];
    for (const [index, row] of saved.entries()) {
      const splits = parsed[index]?.splits;
      if (!splits || splits.length < 2 || row.isDuplicate) {
        rows.push(row);
        continue;
      }
      let made: Transaction[];
      try {
        const parts = await this.splitParts(statement, row, splits);
        made = await this.transactionsService.split(row.id, row.workspaceId, statement.userId, {
          parts,
        });
      } catch (error) {
        log('warn', `Row ${index + 1} stays whole: its split could not be made (${reason(error)})`);
        rows.push(row);
        continue;
      }
      try {
        await this.keepFileFacts(row, made, splits);
      } catch (error) {
        log('warn', `Row ${index + 1}: its parts lost the file's details (${reason(error)})`);
      }
      rows.push(...made);
    }
    return rows;
  }

  /**
   * What `split()` clears or copies but the file still says: part 0 takes back
   * the whole row's fingerprint, so importing an overlapping file again marks
   * that row a duplicate instead of adding its parts a second time, and a part
   * the file sent to another account keeps that `[Account]`.
   */
  private async keepFileFacts(
    row: Transaction,
    made: Transaction[],
    splits: ParsedSplit[],
  ): Promise<void> {
    const repository = this.dataSource.getRepository(Transaction);
    for (const [index, part] of made.entries()) {
      const patch: Partial<Pick<Transaction, 'fingerprint' | 'categoryHint'>> = {};
      if (index === 0 && row.fingerprint) patch.fingerprint = row.fingerprint;
      const hint = splits[index] ? transferHint(splits[index]) : null;
      if (hint) patch.categoryHint = hint;
      if (Object.keys(patch).length === 0) continue;
      await repository.update({ id: part.id, workspaceId: row.workspaceId }, patch);
      Object.assign(part, patch);
    }
  }

  /**
   * Each part keeps its own category from the file, and a part without one
   * (a transfer part too: split parts are never paired) goes to Uncategorized, unless a rule categorised the row (or the user
   * picks categories by hand): then every part keeps the row's category.
   */
  private async splitParts(
    statement: Statement,
    row: Transaction,
    splits: ParsedSplit[],
  ): Promise<SplitPartInput[]> {
    const manual = statement.parsingDetails?.manualCategorySelectionRequired === true;
    const fileDecides = !manual && row.categorySource !== TransactionCategorySource.RULE;
    const parts: SplitPartInput[] = [];
    for (const split of splits) {
      let categoryId: string | null = null;
      if (fileDecides) {
        const named = split.categoryName
          ? await this.fileCategory(row, statement.userId, split.categoryName)
          : null;
        categoryId = named ?? (await this.uncategorized(row, statement.userId));
      }
      parts.push({
        amount: split.amount,
        ...(categoryId ? { categoryId } : {}),
        ...(split.memo ? { paymentPurpose: split.memo } : {}),
      });
    }
    return parts;
  }

  /** The workspace category for a 'Food:Groceries' path, made level by level when missing. */
  private async fileCategory(
    row: Pick<Transaction, 'workspaceId' | 'transactionType'>,
    userId: string,
    path: string,
  ): Promise<string | null> {
    const repository = this.dataSource.getRepository(Category);
    const type = row.transactionType === TransactionType.INCOME ? 'income' : 'expense';
    const scope = { workspaceId: row.workspaceId, userId };
    let parentId: string | undefined;
    let createdAny = false;
    for (const level of path.split(':')) {
      const found = await categoryByName(repository, scope, level, type, {
        parentId,
        create: true,
      });
      if (!found) return null;
      createdAny ||= found.created;
      parentId = found.id;
    }
    if (createdAny) {
      await this.classificationService.invalidateWorkspaceCategoriesCache(row.workspaceId);
    }
    return parentId ?? null;
  }

  private async uncategorized(row: Transaction, userId: string): Promise<string | null> {
    const type =
      row.transactionType === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    const id = await this.classificationService.ensureCategory(
      userId,
      UNCATEGORIZED_CATEGORY_NAME,
      type,
      undefined,
      row.workspaceId,
    );
    return id ?? null;
  }
}
