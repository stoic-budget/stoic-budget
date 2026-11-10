import { Module } from '@nestjs/common';
import { ApplicationSettingsModule } from '../application-settings/application-settings.module';
import { SystemHealthModule } from '../system-health/system-health.module';
import { MailerService } from './mailer.service';

@Module({
  imports: [ApplicationSettingsModule, SystemHealthModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
