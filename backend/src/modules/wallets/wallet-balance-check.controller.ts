import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  BalanceAdjustmentResult,
  BalanceCheckBody,
  BalanceCheckResult,
  WalletParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WalletBalanceCheckService } from './wallet-balance-check.service';

/**
 * "Check balance" on an account: the balance the bank shows against ours.
 * Checking is part of keeping the account, so every step needs the right to
 * edit it; a viewer reads the last check on the account but cannot make one.
 */
@Controller('wallets')
export class WalletBalanceCheckController {
  constructor(private readonly balanceCheck: WalletBalanceCheckService) {}

  @Post(':id/balance-check')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(BalanceCheckResult)
  async check(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(BalanceCheckBody) body: BalanceCheckBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.balanceCheck.check(id, workspaceId, body, selfMemberId);
  }

  @Post(':id/balance-check/confirm')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(BalanceCheckResult)
  async confirm(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(BalanceCheckBody) body: BalanceCheckBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.balanceCheck.confirm(id, workspaceId, body, selfMemberId);
  }

  @Post(':id/balance-adjustment')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.WALLET_EDIT, Permission.TRANSACTION_EDIT)
  @SchemaResponse(BalanceAdjustmentResult)
  async bookAdjustment(
    @SchemaParams(WalletParams) { id }: WalletParams,
    @SchemaBody(BalanceCheckBody) body: BalanceCheckBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.balanceCheck.bookAdjustment(id, workspaceId, body, user, selfMemberId);
  }
}
