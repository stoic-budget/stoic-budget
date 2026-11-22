import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { HealthRedisService } from './health-redis.service';
import { SystemHealthController } from './system-health.controller';
import { SystemHealthService } from './system-health.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

/**
 * Readiness, worker heartbeats and the admin's health page. Imported through
 * SystemUpdateModule (instance-wide admin features); MailerModule imports it to
 * record how the server's mail went.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [SystemHealthController],
  providers: [HealthRedisService, SystemHealthService, WorkerHeartbeatService],
  exports: [HealthRedisService, SystemHealthService],
})
export class SystemHealthModule {}
