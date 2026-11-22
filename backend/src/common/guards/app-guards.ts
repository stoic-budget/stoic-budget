import type { Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CsrfGuard } from './csrf.guard';
import { DemoReadOnlyGuard } from './demo-read-only.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

/** The global guards, in the order they run. */
export const APP_GUARDS: Provider[] = [
  // First: a demo instance refuses writes before anything else looks at them.
  { provide: APP_GUARD, useClass: DemoReadOnlyGuard },
  // Before JwtAuthGuard: a forged cross-site request should be rejected
  // before it reaches authentication or any handler.
  { provide: APP_GUARD, useClass: CsrfGuard },
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
];
