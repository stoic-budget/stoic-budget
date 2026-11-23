import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../../common/errors/app-error';
import { calculateStringSimilarity } from '../../../common/utils/string-similarity.util';
import { Receipt } from '../../../entities';

@Injectable()
export class ReceiptDuplicateService {
  private readonly logger = new Logger(ReceiptDuplicateService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  async findPotentialDuplicates(receipt: Receipt): Promise<Receipt[]> {
    try {
      if (!(receipt.parsedData?.amount && receipt.parsedData?.date)) {
        return [];
      }

      const amount = receipt.parsedData.amount;
      const dateStr = receipt.parsedData.date;
      const vendor = receipt.parsedData.vendor;

      const receiptDate = new Date(dateStr);
      if (Number.isNaN(receiptDate.getTime())) {
        return [];
      }

      // In UTC: the stated day is a UTC midnight, and a local step across a
      // clock change would land on the wrong day.
      const dateFrom = new Date(receiptDate);
      dateFrom.setUTCDate(dateFrom.getUTCDate() - 2);
      const dateTo = new Date(receiptDate);
      dateTo.setUTCDate(dateTo.getUTCDate() + 2);

      const amountMin = amount * 0.99;
      const amountMax = amount * 1.01;

      const candidates = await this.receiptRepository
        .createQueryBuilder('receipt')
        .where('receipt.userId = :userId', { userId: receipt.userId })
        .andWhere('receipt.workspaceId = :workspaceId', { workspaceId: receipt.workspaceId })
        .andWhere('receipt.id != :id', { id: receipt.id })
        .andWhere('receipt.isDuplicate = :isDuplicate', { isDuplicate: false })
        // Compared by the day of purchase each receipt states: a photo of the same
        // receipt taken days later is still the same purchase. Only a receipt
        // whose date was not read falls back to when it arrived.
        .andWhere(
          `(LEFT(receipt.parsed_data->>'date', 10) BETWEEN :dayFrom AND :dayTo
            OR (COALESCE(receipt.parsed_data->>'date', '') !~ '^\\d{4}-\\d{2}-\\d{2}'
                AND receipt.receivedAt BETWEEN :dateFrom AND :dateTo))`,
          {
            dayFrom: dateFrom.toISOString().slice(0, 10),
            dayTo: dateTo.toISOString().slice(0, 10),
            dateFrom,
            dateTo,
          },
        )
        .getMany();

      const duplicates: Receipt[] = [];
      for (const candidate of candidates) {
        if (!candidate.parsedData?.amount) {
          continue;
        }

        const candidateAmount = candidate.parsedData.amount;
        if (candidateAmount < amountMin || candidateAmount > amountMax) {
          continue;
        }

        if (vendor && candidate.parsedData.vendor) {
          const similarity = calculateStringSimilarity(
            vendor.toLowerCase(),
            candidate.parsedData.vendor.toLowerCase(),
          );
          if (similarity > 0.8) {
            duplicates.push(candidate);
          }
        } else if (!(vendor || candidate.parsedData.vendor)) {
          duplicates.push(candidate);
        }
      }

      return duplicates;
    } catch (error) {
      this.logger.error('Failed to find potential duplicates', error);
      return [];
    }
  }

  // Both lookups are scoped to the caller's workspace: without it, `originalId`
  // was an unvalidated pointer to any receipt in the database, and the caller got
  // the linked record echoed back through the `duplicateOf` relation.
  async markAsDuplicate(receiptId: string, originalId: string, workspaceId: string): Promise<void> {
    const receipt = await this.receiptRepository.findOne({ where: { id: receiptId, workspaceId } });
    if (!receipt) {
      throw new NotFoundException(appError('RECEIPT_NOT_FOUND'));
    }

    const original = await this.receiptRepository.findOne({
      where: { id: originalId, workspaceId },
    });
    if (!original) {
      throw new NotFoundException(appError('RECEIPT_ORIGINAL_NOT_FOUND'));
    }

    receipt.duplicateOfId = originalId;
    receipt.isDuplicate = true;
    await this.receiptRepository.save(receipt);
  }

  async unmarkDuplicate(receiptId: string, workspaceId: string): Promise<void> {
    const receipt = await this.receiptRepository.findOne({ where: { id: receiptId, workspaceId } });
    if (!receipt) {
      throw new NotFoundException(appError('RECEIPT_NOT_FOUND'));
    }

    receipt.duplicateOfId = null;
    receipt.isDuplicate = false;
    await this.receiptRepository.save(receipt);
  }
}
