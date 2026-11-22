import { Controller, Get } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { PayPeriodsResponse } from '../../contracts';
import { PayPeriodService } from './pay-period.service';

@Controller('pay-periods')
export class PayPeriodController {
  constructor(private readonly payPeriods: PayPeriodService) {}

  /** The workspace's month rule and its current and next period; any member may read it. */
  @Get()
  @WorkspaceAuth()
  @SchemaResponse(PayPeriodsResponse)
  async describe(@WorkspaceId() workspaceId: string) {
    return this.payPeriods.describe(workspaceId);
  }
}
