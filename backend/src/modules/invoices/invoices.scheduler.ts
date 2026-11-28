import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Not, type Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import { Invoice, InvoiceStatus } from '../../entities/invoice.entity';
import { InvoiceLineItem } from '../../entities/invoice-line-item.entity';
import { advanceIssueDate } from './invoice-recurrence.util';
import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoicesScheduler {
  private readonly logger = new Logger(InvoicesScheduler.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepository: Repository<InvoiceLineItem>,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async generateRecurringInvoices(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    // A past version keeps its copied recurring templates but never issues from them.
    const templates = await this.invoiceRepository.find({
      where: {
        isRecurring: true,
        // A void invoice is no template, whatever its recurrence still says.
        status: Not(InvoiceStatus.VOID),
        nextIssueDate: LessThanOrEqual(today),
        deletedAt: IsNull(),
        workspace: STANDARD_WORKSPACE,
      },
    });

    for (const template of templates) {
      if (template.recurrenceEndDate && template.recurrenceEndDate < today) {
        continue;
      }
      try {
        await this.generateOne(template);
      } catch (error) {
        this.logger.warn(
          `Failed to generate recurring invoice from ${template.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Ends an invoice's series, whatever its status: an issued invoice cannot be
   * edited, yet the client must be able to stop being billed.
   */
  async stopSeries(id: string, workspaceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id, workspaceId } });
    if (!invoice) {
      throw new NotFoundException(appError('INVOICE_NOT_FOUND'));
    }
    Object.assign(invoice, { isRecurring: false, recurrenceInterval: null, nextIssueDate: null });
    return this.invoiceRepository.save(invoice);
  }

  private async generateOne(template: Invoice): Promise<void> {
    const lineItems = await this.lineItemRepository.find({
      where: { invoiceId: template.id },
      order: { sortOrder: 'ASC' },
    });
    if (lineItems.length === 0 || !template.recurrenceInterval) {
      return;
    }
    await this.invoicesService.cloneAsDraft(template, lineItems);

    // Anchored on the template's own issue date: advancing from a clamped
    // month-end (28 February) would otherwise move the whole series onto the 28th.
    const next = advanceIssueDate(
      template.nextIssueDate as string,
      template.recurrenceInterval,
      template.issueDate,
    );
    await this.invoiceRepository.update({ id: template.id }, { nextIssueDate: next });
  }
}
