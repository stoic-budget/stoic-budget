import { Controller, Delete, Get, Headers, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AddPayablePaymentBody,
  AllocateTransactionBody,
  AllocationSuggestion,
  BookPayablePaymentBody,
  CreatePayableBody,
  FilterPayablesBody,
  MarkPayablePaidBody,
  MessageResult,
  Payable,
  PayableList,
  PayableListPage,
  PayableOccurrenceBody,
  PayableParams,
  PayablePaymentList,
  PayablePaymentParams,
  PayablesQuery,
  PayablesSummary,
  PayableTransactionParams,
  PaymentCandidateList,
  RejectPayableMatchBody,
  UpdatePayableBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { PayableDirection } from '../../entities/payable.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PayableOccurrencesService } from './payable-occurrences.service';
import { PayableRecurrenceService } from './payable-recurrence.service';
import { PayablesService } from './payables.service';

@Controller('payables')
export class PayablesController {
  constructor(
    private readonly payablesService: PayablesService,
    private readonly idempotencyService: IdempotencyService,
    private readonly recurrence: PayableRecurrenceService,
    private readonly occurrences: PayableOccurrencesService,
  ) {}

  /** Send `idempotency-key` to make a retried request return the first bill. */
  @Post()
  @WorkspaceAuth(Permission.PAYABLE_CREATE)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async create(
    @SchemaBody(CreatePayableBody) createDto: CreatePayableBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Namespaced: the key table is shared by every endpoint that takes one.
    const key = idempotencyKey ? `payable:${idempotencyKey}` : null;
    if (key) {
      const cached = await this.idempotencyService.checkKey(key, user.id, workspaceId);
      if (cached) {
        return cached.data;
      }
    }
    const payable = await this.payablesService.create(workspaceId, user.id, createDto);
    // A rule whose next dates are already near makes those occurrences now.
    await this.recurrence.ensureSeriesOf(payable);
    if (key) {
      await this.idempotencyService.storeKey(key, user.id, workspaceId, payable);
    }
    return payable;
  }

  @Get()
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayableListPage)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(PayablesQuery) query: PayablesQuery,
  ) {
    return this.payablesService.findAll(workspaceId, query);
  }

  @Get('summary')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayablesSummary)
  async getSummary(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(PayablesQuery) query: PayablesQuery,
  ) {
    return this.payablesService.getSummary(workspaceId, toEnum(PayableDirection, query.direction));
  }

  @Get(':id')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(Payable)
  async findOne(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.findOne(id, workspaceId);
  }

  @Get(':id/payment-candidates')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PaymentCandidateList)
  async findPaymentCandidates(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.payablesService.findPaymentCandidates(id, workspaceId, selfMemberId);
  }

  @Get(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(PayablePaymentList)
  async listPayments(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.listPayments(id, workspaceId);
  }

  @Post(':id/payments')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async addPayment(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(AddPayablePaymentBody) dto: AddPayablePaymentBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.addPayment(id, workspaceId, user.id, dto);
  }

  /** Where the money of a payment marked without it went: a bank row, or a wallet. */
  @Post(':id/payments/:paymentId/book')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async bookPayment(
    @SchemaParams(PayablePaymentParams) { id, paymentId }: PayablePaymentParams,
    @SchemaBody(BookPayablePaymentBody) dto: BookPayablePaymentBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.bookPayment(id, paymentId, workspaceId, user.id, dto);
  }

  @Delete(':id/payments/:paymentId')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async removePayment(
    @SchemaParams(PayablePaymentParams) { id, paymentId }: PayablePaymentParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.removePayment(id, paymentId, workspaceId);
  }

  /** Which bills one transaction probably covers; writes nothing. */
  @Get('allocation-suggestion/:transactionId')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(AllocationSuggestion)
  async suggestAllocation(
    @SchemaParams(PayableTransactionParams) { transactionId }: PayableTransactionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.suggestAllocation(workspaceId, transactionId);
  }

  /** One transaction spread over several bills. */
  @Post('allocate')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: false, isUndoable: false })
  @SchemaResponse(PayableList)
  async allocate(
    @SchemaBody(AllocateTransactionBody) dto: AllocateTransactionBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.allocateTransaction(workspaceId, user.id, dto);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async update(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(UpdatePayableBody) updateDto: UpdatePayableBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const payable = await this.payablesService.update(id, workspaceId, user.id, updateDto);
    await this.recurrence.ensureSeriesOf(payable);
    return payable;
  }

  /** One occurrence of a repeating bill: skip it, move it or change its amount; the series stays. */
  @Put(':id/occurrence')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: false })
  @SchemaResponse(Payable)
  async changeOccurrence(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(PayableOccurrenceBody) body: PayableOccurrenceBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.occurrences.apply(id, workspaceId, body);
  }

  /** "Not this payment": this bank row is never proposed or linked to the bill again. */
  @Post(':id/match-rejections')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: false })
  @SchemaResponse(Payable)
  async rejectMatch(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(RejectPayableMatchBody) { transactionId }: RejectPayableMatchBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.occurrences.reject(id, workspaceId, user.id, transactionId);
  }

  @Put(':id/mark-paid')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async markAsPaid(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(MarkPayablePaidBody) body: MarkPayablePaidBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.markAsPaid(id, workspaceId, user.id, body);
  }

  @Put(':id/archive')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(Payable)
  async archive(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payablesService.archive(id, workspaceId, user.id);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.PAYABLE_DELETE)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: true })
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.payablesService.remove(id, workspaceId, user.id);
    return deletedResponse('Payable');
  }

  @Post('export')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  async export(
    @SchemaBody(FilterPayablesBody) body: FilterPayablesBody,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, contentType } = await this.payablesService.exportData(
      workspaceId,
      body,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    const fileStream = fs.createReadStream(filePath);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore cleanup failures
      }
    };
    fileStream.pipe(res);
    fileStream.on('end', cleanup);
    fileStream.on('error', cleanup);
    res.on('close', cleanup);
  }
}
