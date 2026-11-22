import { Injectable } from '@nestjs/common';
import { SystemHealthService } from './modules/system-health/system-health.service';

@Injectable()
export class AppService {
  constructor(private readonly systemHealth: SystemHealthService) {}

  getHealth(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'seneca-backend',
    };
  }

  /**
   * The database and Redis, nothing slower: a container health check and the
   * upgrade scripts wait on this, so a long queue must not fail it. Queues and
   * setup are on the admin's `GET /system/health`.
   */
  async getReadiness(): Promise<{
    status: 'ok' | 'error';
    checks: Record<string, 'ok' | 'error'>;
  }> {
    const [db, redis] = await Promise.all([
      this.systemHealth.pingDatabase(),
      this.systemHealth.pingRedis(),
    ]);
    const checks: Record<string, 'ok' | 'error'> = {
      db: db ? 'ok' : 'error',
      redis: redis ? 'ok' : 'error',
    };
    const status = Object.values(checks).every(v => v === 'ok') ? 'ok' : 'error';
    return { status, checks };
  }
}
