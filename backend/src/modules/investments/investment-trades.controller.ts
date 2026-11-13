import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateInvestmentTradeBody,
  HoldingLots,
  InvestmentParams,
  InvestmentSettings,
  InvestmentSettingsBody,
  InvestmentTrade,
  InvestmentTradeList,
  UpdateInvestmentTradeBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvestmentSettingsService } from './investment-settings.service';
import { InvestmentTradesService } from './investment-trades.service';

/**
 * Trades behind a holding, its lots and realised results, and the cost-basis
 * method. Reads are reports; writes take the wallet permissions, like the
 * holdings they change.
 */
@Controller('investments')
export class InvestmentTradesController {
  constructor(
    private readonly tradesService: InvestmentTradesService,
    private readonly settingsService: InvestmentSettingsService,
  ) {}

  @Get('holdings/:id/trades')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(InvestmentTradeList)
  list(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    return this.tradesService.list(workspaceId, id);
  }

  @Post('holdings/:id/trades')
  @WorkspaceAuth(Permission.WALLET_CREATE)
  @SchemaResponse(InvestmentTrade)
  create(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(CreateInvestmentTradeBody) body: CreateInvestmentTradeBody,
  ) {
    return this.tradesService.create(user.id, workspaceId, memberId, id, body);
  }

  @Patch('trades/:id')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(InvestmentTrade)
  update(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
    @SchemaBody(UpdateInvestmentTradeBody) body: UpdateInvestmentTradeBody,
  ) {
    return this.tradesService.update(user.id, workspaceId, memberId, id, body);
  }

  @Delete('trades/:id')
  @HttpCode(204)
  @WorkspaceAuth(Permission.WALLET_DELETE)
  async remove(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    await this.tradesService.remove(user.id, workspaceId, id);
  }

  @Get('holdings/:id/lots')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(HoldingLots)
  lots(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(InvestmentParams) { id }: InvestmentParams,
  ) {
    return this.tradesService.lots(workspaceId, id);
  }

  @Get('settings')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(InvestmentSettings)
  settings(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getSettings(workspaceId);
  }

  @Patch('settings')
  @WorkspaceAuth(Permission.WALLET_EDIT)
  @SchemaResponse(InvestmentSettings)
  updateSettings(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(InvestmentSettingsBody) body: InvestmentSettingsBody,
  ) {
    return this.settingsService.updateSettings(user.id, workspaceId, body);
  }
}
