import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { AddStatementRowBody, StatementParams, StatementRecheck } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StatementRowsService } from './statement-rows.service';

/** A statement's rows corrected by hand, and its checks held against them. */
@Controller('statements')
export class StatementRowsController {
  constructor(private readonly rows: StatementRowsService) {}

  @Post(':id/rows')
  @HttpCode(200)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Add a row the reading missed, then check the statement again' })
  @SchemaResponse(StatementRecheck)
  addRow(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @SchemaBody(AddStatementRowBody) body: AddStatementRowBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.rows.addRow(id, user.id, workspaceId, body);
  }

  @Post(':id/recheck')
  @HttpCode(200)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: "Hold the statement's checks against its rows as they are now" })
  @SchemaResponse(StatementRecheck)
  recheck(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.rows.recheck(id, user.id, workspaceId);
  }
}
