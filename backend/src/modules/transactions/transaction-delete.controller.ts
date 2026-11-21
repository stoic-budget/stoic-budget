import { Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { BulkDeleteTransactionsBody, TransactionParams } from '../../contracts';
import { TransactionsDeleted } from '../../contracts/transactions/transaction-record';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransactionDeleteService } from './services/transaction-delete.service';

/** One row or many: both routes run the same remove, so they cannot drift apart. */
@Controller('transactions')
export class TransactionDeleteController {
  constructor(private readonly deleteService: TransactionDeleteService) {}

  /** All or nothing: one id that is not the workspace's refuses the whole list. */
  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_DELETE)
  @SchemaResponse(TransactionsDeleted)
  async bulkDelete(
    @SchemaBody(BulkDeleteTransactionsBody) body: BulkDeleteTransactionsBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return { deleted: await this.deleteService.remove(body.ids, workspaceId, user.id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.TRANSACTION_DELETE)
  async remove(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.deleteService.remove([id], workspaceId, user.id);
  }
}
