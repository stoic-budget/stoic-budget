import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  HoldingPriceHistory,
  ImportClosesResult,
  ImportSecurityClosesBody,
  InvestmentParams,
  SecurityClose,
  SecurityCloseList,
  UpsertSecurityCloseBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HoldingHistoryService } from './holding-history.service';
import { SecurityClosesService } from './security-closes.service';

/**
 * A holding's value over time and the closes it stands on. Reads are reports;
 * the closes a workspace enters or imports take the wallet permissions, like
 * the prices typed into its holdings.
 */
@Controller('investments')
export class PriceHistoryController {
  constructor(
    private readonly historyService: HoldingHistoryService,
    private readonly closesService: SecurityClosesService,
  ) {}

  @Get('holdings/:id/history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(HoldingPriceHistory)
  history(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    return this.historyService.history(workspaceId, id);
  }

  @Get('holdings/:id/closes')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(SecurityCloseList)
  closes(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    return this.closesService.list(workspaceId, id);
  }

  @Post('holdings/:id/closes')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(SecurityClose)
  upsertClose(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(UpsertSecurityCloseBody) body: UpsertSecurityCloseBody,
  ) {
    return this.closesService.upsert(user.id, workspaceId, id, body);
  }

  @Post('holdings/:id/closes/import')
  @HttpCode(200)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(ImportClosesResult)
  importCloses(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(ImportSecurityClosesBody) body: ImportSecurityClosesBody,
  ) {
    return this.closesService.import(user.id, workspaceId, id, body);
  }

  @Delete('closes/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_EDIT)
  async removeClose(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    await this.closesService.remove(user.id, workspaceId, id);
  }
}
