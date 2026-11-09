import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { CreateRuleGroupBody, RuleGroupParams, UpdateRuleGroupBody } from '../../contracts';
import { RuleGroup, RuleGroupList } from '../../contracts/classification/rule-groups';
import { RuleGroupsService } from './services/rule-groups.service';

/** Folders on the rules page. A rule goes in one through `PUT /categorization-rules/:id`. */
@Controller('categorization-rule-groups')
export class RuleGroupsController {
  constructor(private readonly groups: RuleGroupsService) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(RuleGroupList)
  async list(@WorkspaceId() workspaceId: string) {
    return { data: await this.groups.list(workspaceId) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(RuleGroup)
  create(
    @SchemaBody(CreateRuleGroupBody) body: CreateRuleGroupBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.groups.create(workspaceId, body.name);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(RuleGroup)
  rename(
    @SchemaParams(RuleGroupParams) { id }: RuleGroupParams,
    @SchemaBody(UpdateRuleGroupBody) body: UpdateRuleGroupBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.groups.rename(workspaceId, id, body.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  async remove(
    @SchemaParams(RuleGroupParams) { id }: RuleGroupParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.groups.remove(workspaceId, id);
  }
}
