import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ActorType } from '../../entities/audit-event.entity';
import { type AuditActor, runWithAuditActor } from '../audit-actor.context';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Signs the request with its real actor before any handler runs: an API key,
 * or an MCP app connected over OAuth, becomes an `integration` actor named
 * after it. Plain user sessions carry no actor and audit as the user, as before.
 */
@Injectable()
export class AuditActorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = resolveAuditActor(request);
    if (!actor) {
      return next.handle();
    }
    // The handler is invoked on subscribe, so the store has to wrap that moment.
    return new Observable(subscriber => {
      const subscription = runWithAuditActor(actor, () => next.handle().subscribe(subscriber));
      return () => subscription.unsubscribe();
    });
  }
}

export function resolveAuditActor(request: {
  apiKey?: { id: string; name: string; prefix: string } | null;
  mcpGrant?: { id: string; clientId: string; clientName: string } | null;
}): AuditActor | null {
  if (request.apiKey) {
    return {
      actorType: ActorType.INTEGRATION,
      actorLabel: `API key "${request.apiKey.name}" (${request.apiKey.prefix})`,
      meta: { apiKeyId: request.apiKey.id, apiKeyPrefix: request.apiKey.prefix },
    };
  }
  if (request.mcpGrant) {
    return {
      actorType: ActorType.INTEGRATION,
      actorLabel: `Connected app "${request.mcpGrant.clientName}"`,
      meta: { mcpGrantId: request.mcpGrant.id, mcpClientId: request.mcpGrant.clientId },
    };
  }
  return null;
}
