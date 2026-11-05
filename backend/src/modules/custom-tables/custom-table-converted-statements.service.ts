import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { ClassificationService } from '../classification/services/classification.service';
import { throwHelpfulSchemaError } from './helpers/schema-error';

@Injectable()
export class CustomTableConvertedStatementsService {
  private readonly logger = new Logger(CustomTableConvertedStatementsService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    // Optional: unit tests build the service without the classifier.
    @Optional() private readonly classificationService?: ClassificationService,
  ) {}

  /**
   * Runs the workspace classifier over freshly converted rows so the statement
   * lands on the dashboard already categorised. Enrichment is best effort:
   * a classifier failure must not undo the conversion itself.
   */
  async categorizeConvertedTransactions(
    userId: string,
    transactions: Transaction[],
  ): Promise<void> {
    const pending = transactions.filter(transaction => !transaction.categoryId);
    if (!(this.classificationService && pending.length)) {
      return;
    }
    try {
      for (const transaction of pending) {
        // Same order as a statement import: rules, keywords and what the user taught.
        const classification = await this.classificationService.classifyTransaction(
          transaction,
          userId,
        );
        const { categoryId, categorySource, categoryReason } = classification;
        if (categoryId) {
          await this.transactionRepository.update(
            { id: transaction.id },
            {
              categoryId,
              categorySource: categorySource ?? null,
              categoryReason: categoryReason ?? null,
            },
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `Categorization after table conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findConvertedStatement(workspaceId: string, tableId: string): Promise<Statement | null> {
    try {
      return await this.statementRepository
        .createQueryBuilder('statement')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .andWhere('statement.deletedAt IS NULL')
        .andWhere("statement.parsingDetails -> 'importPreview' ->> 'source' = :source", {
          source: 'custom-table-conversion',
        })
        .andWhere("statement.parsingDetails -> 'importPreview' ->> 'customTableId' = :tableId", {
          tableId,
        })
        .getOne();
    } catch (error) {
      throwHelpfulSchemaError(error);
    }
  }
}
