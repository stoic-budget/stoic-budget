import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  LoanSchedule,
  LoanTermsBody,
  LoanTermsState,
  LoanWhatIf,
  LoanWhatIfBody,
  MessageResult,
  WalletParams,
} from '../../contracts';
import { LoanScheduleService } from './loan-schedule.service';
import { LoanTermsService } from './loan-terms.service';

/** The terms and the schedule of a loan or credit card account. */
@Controller('wallets')
export class LoansController {
  constructor(
    private readonly loanTerms: LoanTermsService,
    private readonly loanSchedule: LoanScheduleService,
  ) {}

  @Get(':id/loan-terms')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(LoanTermsState)
  async terms(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.loanTerms.get(id, workspaceId);
  }

  @Put(':id/loan-terms')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(LoanTermsState)
  async saveTerms(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(LoanTermsBody) body: LoanTermsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.loanTerms.put(id, workspaceId, body);
  }

  @Delete(':id/loan-terms')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(MessageResult)
  async removeTerms(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.loanTerms.remove(id, workspaceId);
    return deletedResponse('Loan terms');
  }

  @Get(':id/loan-schedule')
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(LoanSchedule)
  async schedule(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.loanSchedule.schedule(id, workspaceId);
  }

  /** Nothing is saved: the answer compares the plan with the plan plus the extra payments. */
  @Post(':id/loan-schedule/what-if')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.WALLET_VIEW)
  @SchemaResponse(LoanWhatIf)
  async whatIf(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(LoanWhatIfBody) body: LoanWhatIfBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.loanSchedule.whatIf(id, workspaceId, body);
  }
}
