import { Controller, Get, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  LatePaymentsSummary,
  Payable,
  PayableParams,
  SetPayableLateReasonBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { PayableLateReasonsService } from './payable-late-reasons.service';

/** Why a bill was paid late, and the year's reasons on the bills page. */
@Controller()
export class PayableLateReasonsController {
  constructor(private readonly lateReasons: PayableLateReasonsService) {}

  @Put('payables/:id/late-reason')
  @WorkspaceAuth(Permission.PAYABLE_EDIT)
  @Audit({ entityType: EntityType.PAYABLE, includeDiff: true, isUndoable: false })
  @SchemaResponse(Payable)
  async set(
    @SchemaParams(PayableParams) { id }: PayableParams,
    @SchemaBody(SetPayableLateReasonBody) body: SetPayableLateReasonBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.lateReasons.set(id, workspaceId, body);
  }

  @Get('late-payments/summary')
  @WorkspaceAuth(Permission.PAYABLE_VIEW)
  @SchemaResponse(LatePaymentsSummary)
  async summary(@WorkspaceId() workspaceId: string) {
    return this.lateReasons.summary(workspaceId);
  }
}
