import { Module } from '@nestjs/common';
import { SystemHealthModule } from '../system-health/system-health.module';
import { SystemUpdateController } from './system-update.controller';
import { SystemUpdateService } from './system-update.service';

@Module({
  // Re-exported so the app's readiness check reaches it without growing app.module.ts.
  imports: [SystemHealthModule],
  controllers: [SystemUpdateController],
  providers: [SystemUpdateService],
  exports: [SystemHealthModule],
})
export class SystemUpdateModule {}
