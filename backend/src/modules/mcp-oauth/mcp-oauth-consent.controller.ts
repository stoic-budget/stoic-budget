import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { appError } from '../../common/errors/app-error';
import { InstanceAdminGuard } from '../../common/guards/instance-admin.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import {
  McpOAuthConsent,
  McpOAuthConsentQuery,
  McpOAuthDecisionBody,
  McpOAuthGrantIdParams,
  McpOAuthGrantList,
  McpOAuthRedirect,
  RegistrationStatus,
  SaveRegistrationBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { McpOAuthClientsService } from './mcp-oauth-clients.service';
import { McpOAuthConsentService } from './mcp-oauth-consent.service';
import { McpOAuthGrantsService } from './mcp-oauth-grants.service';

/** Consent is given by a person in a session: an API key cannot hand out access of its own. */
export const assertSession = (request: AuthenticatedRequest): void => {
  if (request.apiKey) {
    throw new ForbiddenException(appError('AUTH_API_KEY_ROUTE_FORBIDDEN'));
  }
};

/** The signed-in side of MCP OAuth: the consent screen and the "Connected apps" list. */
@ApiTags('MCP OAuth')
@Controller()
export class McpOAuthConsentController {
  constructor(
    private readonly consent: McpOAuthConsentService,
    private readonly grants: McpOAuthGrantsService,
    private readonly clients: McpOAuthClientsService,
  ) {}

  @Get('oauth/consent')
  @ApiOperation({ summary: 'Check an authorization request and list what can be granted' })
  @SchemaResponse(McpOAuthConsent)
  preview(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() user: User,
    @SchemaQuery(McpOAuthConsentQuery) query: McpOAuthConsentQuery,
  ) {
    assertSession(request);
    return this.consent.preview(user, query);
  }

  @Post('oauth/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or deny an MCP client' })
  @SchemaResponse(McpOAuthRedirect)
  decide(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() user: User,
    @SchemaBody(McpOAuthDecisionBody) body: McpOAuthDecisionBody,
  ) {
    assertSession(request);
    return this.consent.decide(user, body);
  }

  @Get('mcp-oauth/grants')
  @UseGuards(WorkspaceContextGuard)
  @ApiOperation({ summary: 'Apps the caller connected to this workspace over OAuth' })
  @SchemaResponse(McpOAuthGrantList)
  list(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.grants.list(workspaceId, user.id);
  }

  @Delete('mcp-oauth/grants/:id')
  @UseGuards(WorkspaceContextGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect an app: revokes its grant and tokens' })
  async revoke(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(McpOAuthGrantIdParams) { id }: McpOAuthGrantIdParams,
  ) {
    await this.grants.revokeOwn(id, workspaceId, user.id);
  }

  @Get('settings/instance/mcp-oauth-registration')
  @UseGuards(InstanceAdminGuard)
  @ApiOperation({ summary: 'Whether MCP clients may register themselves' })
  @SchemaResponse(RegistrationStatus)
  async registration() {
    return { open: await this.clients.isRegistrationOpen() };
  }

  @Put('settings/instance/mcp-oauth-registration')
  @UseGuards(InstanceAdminGuard)
  @ApiOperation({ summary: 'Open or close MCP client registration' })
  @SchemaResponse(RegistrationStatus)
  async saveRegistration(
    @CurrentUser() user: User,
    @SchemaBody(SaveRegistrationBody) body: SaveRegistrationBody,
  ) {
    await this.clients.setRegistrationOpen(user, body.open);
    return { open: await this.clients.isRegistrationOpen() };
  }
}
