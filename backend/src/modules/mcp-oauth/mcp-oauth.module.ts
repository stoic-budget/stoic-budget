import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceSetting } from '../../entities/instance-setting.entity';
import { McpOAuthClient } from '../../entities/mcp-oauth-client.entity';
import { McpOAuthCode } from '../../entities/mcp-oauth-code.entity';
import { McpOAuthGrant } from '../../entities/mcp-oauth-grant.entity';
import { McpOAuthToken } from '../../entities/mcp-oauth-token.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { McpOAuthController } from './mcp-oauth.controller';
import { McpOAuthAccessService } from './mcp-oauth-access.service';
import { McpOAuthAdminController } from './mcp-oauth-admin.controller';
import { McpOAuthClientsService } from './mcp-oauth-clients.service';
import { McpOAuthConsentController } from './mcp-oauth-consent.controller';
import { McpOAuthConsentService } from './mcp-oauth-consent.service';
import { McpOAuthGrantsService } from './mcp-oauth-grants.service';
import { McpOAuthTokensService } from './mcp-oauth-tokens.service';

/**
 * OAuth 2.1 for the MCP endpoint. Registered through McpModule, which uses its
 * access service; AuthModule uses its grants service to end grants on a password reset.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      McpOAuthClient,
      McpOAuthCode,
      McpOAuthGrant,
      McpOAuthToken,
      WorkspaceMember,
      InstanceSetting,
    ]),
    AuditModule,
  ],
  controllers: [McpOAuthController, McpOAuthConsentController, McpOAuthAdminController],
  providers: [
    McpOAuthClientsService,
    McpOAuthConsentService,
    McpOAuthGrantsService,
    McpOAuthTokensService,
    McpOAuthAccessService,
  ],
  exports: [McpOAuthAccessService, McpOAuthGrantsService],
})
export class McpOAuthModule {}
