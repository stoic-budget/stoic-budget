import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateTagBody,
  MessageResult,
  StorageTag,
  TagIdParams,
  TagList,
  TagSummary,
  TransactionTagLinks,
  UpdateTagBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { TagSummaryService } from './tag-summary.service';
import { TagsService } from './tags.service';

/** The Tags page: the workspace's tags with how often each is used. */
@Controller('tags')
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly summaryService: TagSummaryService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.TAG_VIEW)
  @SchemaResponse(TagList)
  async list(@WorkspaceId() workspaceId: string) {
    return this.tagsService.listWithUsage(workspaceId);
  }

  @Get('transaction-links')
  @WorkspaceAuth(Permission.TAG_VIEW)
  @SchemaResponse(TransactionTagLinks)
  async transactionLinks(@WorkspaceId() workspaceId: string) {
    return this.tagsService.transactionLinks(workspaceId);
  }

  /** The tag page: what the tag counted over all time, as Reports' By tag counts it. */
  @Get(':id/summary')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TagSummary)
  async summary(
    @SchemaParams(TagIdParams) { id }: TagIdParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.summaryService.summary(workspaceId, id, selfMemberId);
  }

  @Post()
  @WorkspaceAuth(Permission.TAG_CREATE)
  @Audit({ entityType: EntityType.TAG, includeDiff: true })
  @SchemaResponse(StorageTag)
  async create(@SchemaBody(CreateTagBody) body: CreateTagBody, @WorkspaceId() workspaceId: string) {
    return this.tagsService.create(body, workspaceId);
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.TAG_EDIT)
  @Audit({ entityType: EntityType.TAG, includeDiff: true })
  @SchemaResponse(StorageTag)
  async update(
    @SchemaParams(TagIdParams) { id }: TagIdParams,
    @SchemaBody(UpdateTagBody) body: UpdateTagBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.tagsService.update(id, body, workspaceId);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.TAG_DELETE)
  @Audit({ entityType: EntityType.TAG, includeDiff: false })
  @SchemaResponse(MessageResult)
  async remove(@SchemaParams(TagIdParams) { id }: TagIdParams, @WorkspaceId() workspaceId: string) {
    await this.tagsService.remove(id, workspaceId);
    return deletedResponse('Tag');
  }
}
