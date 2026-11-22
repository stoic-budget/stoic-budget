import { Controller, Get } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  ForecastQuery,
  ForecastResponse,
  PaycheckPlanQuery,
  PaycheckPlanResponse,
} from '../../contracts';
import { ForecastService } from './forecast.service';
import { PaycheckPlannerService } from './paycheck-planner.service';

@Controller('forecast')
export class ForecastController {
  constructor(
    private readonly forecastService: ForecastService,
    private readonly paycheckPlanner: PaycheckPlannerService,
  ) {}

  /** Projected balance for 30/90/365 days with safe-to-spend, shortfall date, runway and scenarios. */
  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ForecastResponse)
  async getForecast(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(ForecastQuery) query: ForecastQuery,
  ) {
    return this.forecastService.getForecast(workspaceId, query, selfMemberId);
  }

  /** Payday to payday: the periods ahead, what is due in each and what is safe to spend. */
  @Get('paychecks')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(PaycheckPlanResponse)
  async getPaycheckPlan(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(PaycheckPlanQuery) query: PaycheckPlanQuery,
  ) {
    return this.paycheckPlanner.plan(workspaceId, query, selfMemberId);
  }
}
