import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../common/guards/instance-admin.guard';
import { AdminSystemHealth, SystemHealthQuery } from '../../contracts';
import { SystemHealthService } from './system-health.service';

/** Instance-wide, not per workspace: only users with the `admin` role. */
@Controller('system/health')
@UseGuards(InstanceAdminGuard)
// The throttler counts in Redis; this page must still answer "Redis is down".
// Only an instance admin gets past the guard, once a minute from the banner.
@SkipThrottle()
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Services, background queues and the setup checklist, in detail' })
  @ApiResponse({ status: 200, description: 'AdminSystemHealth' })
  @SchemaResponse(AdminSystemHealth)
  @ApiResponse({ status: 403, description: 'INSTANCE_ADMIN_ONLY' })
  getHealth(@SchemaQuery(SystemHealthQuery) query: SystemHealthQuery) {
    return this.systemHealthService.details(query.origin ?? null);
  }
}
