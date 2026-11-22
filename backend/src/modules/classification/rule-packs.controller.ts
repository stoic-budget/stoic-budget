import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { ExportRulePackBody, ImportRulePackBody } from '../../contracts';
import {
  RulePack,
  RulePackImportResult,
  RulePackPreview,
} from '../../contracts/classification/rule-packs';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RulePackService } from './services/rule-pack.service';

/**
 * Rules as a file to keep or share: an export that names what the rules point
 * at, and an import that is previewed before anything is written.
 */
@Controller('categorization-rule-packs')
export class RulePacksController {
  constructor(private readonly packs: RulePackService) {}

  @Post('export')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(RulePack)
  export(
    @SchemaBody(ExportRulePackBody) body: ExportRulePackBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.packs.export(workspaceId, body.ruleIds);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(RulePackPreview)
  preview(
    @SchemaBody(ImportRulePackBody) body: ImportRulePackBody,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.packs.preview({
      workspaceId,
      viewerMemberId: selfMemberId,
      pack: body.pack,
      createMissing: body.createMissing,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(RulePackImportResult)
  import(
    @SchemaBody(ImportRulePackBody) body: ImportRulePackBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.packs.import({
      workspaceId,
      userId: user.id,
      pack: body.pack,
      createMissing: body.createMissing,
    });
  }
}
