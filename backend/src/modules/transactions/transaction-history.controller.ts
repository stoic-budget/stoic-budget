import { Controller, Get, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  TransactionCommentEdit,
  TransactionHistory,
  TransactionHistoryEventParams,
  TransactionParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionCommentEditService } from './services/transaction-comment-edit.service';
import { TransactionHistoryService } from './services/transaction-history.service';

/** A transaction's History tab: what changed on the row, and undoing the latest change of a field. */
@Controller('transactions')
export class TransactionHistoryController {
  constructor(
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly transactionCommentEditService: TransactionCommentEditService,
  ) {}

  @Get(':id/history')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionHistory)
  history(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionHistoryService.history(workspaceId, user.id, id, selfMemberId);
  }

  /** Who last changed the comment, for the quiet line under it in the drawer. */
  @Get(':id/comment-edit')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionCommentEdit)
  commentEdit(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionCommentEditService.latest(workspaceId, user.id, id, selfMemberId);
  }

  @Post(':id/history/:eventId/undo')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionHistory)
  undoHistory(
    @SchemaParams(TransactionHistoryEventParams) { id, eventId }: TransactionHistoryEventParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionHistoryService.undo(workspaceId, user.id, id, eventId, selfMemberId);
  }
}
