import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { BulkAnnotateResult, BulkAnnotateTransactionsBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionBulkAnnotateService } from './services/transaction-bulk-annotate.service';

/** The selection bar of a transaction list: tags and a comment for the ticked rows. */
@Controller('transactions')
export class TransactionBulkController {
  constructor(private readonly bulkAnnotateService: TransactionBulkAnnotateService) {}

  // No @Audit: the service writes one entry per changed row under one batch.
  @Post('bulk-annotate')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_BULK_UPDATE)
  @SchemaResponse(BulkAnnotateResult)
  annotate(
    @SchemaBody(BulkAnnotateTransactionsBody) body: BulkAnnotateTransactionsBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.bulkAnnotateService.annotate(workspaceId, user.id, body, selfMemberId);
  }
}
