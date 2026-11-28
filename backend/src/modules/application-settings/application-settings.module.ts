import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstanceSetting, User, WorkspaceServiceSettings } from '../../entities';
import { AuditModule } from '../audit/audit.module';
import { WorkspacePluginsModule } from '../workspaces/workspace-plugins.module';
import { ApplicationSettingsController } from './application-settings.controller';
import { ApplicationSettingsService } from './application-settings.service';
import { InstanceSettingsController } from './instance-settings.controller';
import { SmtpSettingsService } from './smtp-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceServiceSettings, InstanceSetting, User]),
    AuditModule,
    WorkspacePluginsModule,
  ],
  controllers: [ApplicationSettingsController, InstanceSettingsController],
  providers: [ApplicationSettingsService, SmtpSettingsService],
  exports: [ApplicationSettingsService],
})
export class ApplicationSettingsModule {}
