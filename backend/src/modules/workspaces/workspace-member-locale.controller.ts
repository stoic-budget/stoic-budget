import { Controller, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  SetMyWorkspaceLocaleBody,
  WorkspaceIdParams,
  WorkspaceMemberLocale,
} from '../../contracts';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceMemberLocaleService } from './workspace-member-locale.service';

/** The workspace comes from the path, as in the rest of the workspaces API; membership is checked in the service. */
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceMemberLocaleController {
  constructor(private readonly localeService: WorkspaceMemberLocaleService) {}

  @Put(':id/locale')
  @ApiOperation({ summary: "Set the caller's interface language in this workspace" })
  @ApiResponse({ status: 200, description: 'The stored language' })
  @ApiResponse({ status: 403, description: 'The caller is not a member' })
  @SchemaResponse(WorkspaceMemberLocale)
  setLocale(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
    @SchemaBody(SetMyWorkspaceLocaleBody) body: SetMyWorkspaceLocaleBody,
  ) {
    return this.localeService.setLocale(id, user.id, body.locale);
  }
}
