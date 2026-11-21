import { Controller, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { OkResult, RejectSubscriptionMatchBody, SubscriptionParams } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionMatchRejectionsService } from './subscription-match-rejections.service';

/** "Not this payment" for a subscription; its own controller, the main one is at its size limit. */
@Controller('subscriptions')
export class SubscriptionMatchRejectionsController {
  constructor(private readonly rejections: SubscriptionMatchRejectionsService) {}

  @Post(':id/match-rejections')
  @WorkspaceAuth(Permission.SUBSCRIPTION_EDIT)
  @SchemaResponse(OkResult)
  async reject(
    @SchemaParams(SubscriptionParams) { id }: SubscriptionParams,
    @SchemaBody(RejectSubscriptionMatchBody) { transactionId }: RejectSubscriptionMatchBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.rejections.reject(id, workspaceId, user.id, transactionId);
    return { ok: true as const };
  }
}
