import { Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  LoanPaymentItem,
  LoanPaymentParams,
  LoanPaymentSplitBody,
  LoanPayments,
  MessageResult,
  WalletParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LoanPaymentSplitService } from './loan-payment-split.service';
import { LoanPaymentsService } from './loan-payments.service';

/** The payments into a loan account, split into principal and interest by its schedule. */
@Controller('wallets')
export class LoanPaymentsController {
  constructor(
    private readonly payments: LoanPaymentsService,
    private readonly split: LoanPaymentSplitService,
  ) {}

  @Get(':id/loan-payments')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(LoanPayments)
  async list(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.payments.list(id, workspaceId, selfMemberId);
  }

  @Post(':id/loan-payments/:transactionId/split')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(LoanPaymentItem)
  async splitPayment(
    @SchemaParams(LoanPaymentParams) { id, transactionId }: LoanPaymentParams,
    @SchemaBody(LoanPaymentSplitBody) body: LoanPaymentSplitBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.split.split(id, transactionId, workspaceId, user.id, selfMemberId, body.interest);
  }

  /** Joins the payment back into one: its interest row goes. A payment not split is a no-op. */
  @Delete(':id/loan-payments/:transactionId/split')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(MessageResult)
  async rejoin(
    @SchemaParams(LoanPaymentParams) { id, transactionId }: LoanPaymentParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.split.rejoin(id, transactionId, workspaceId, user.id);
    return { message: 'Payment joined back' };
  }
}
