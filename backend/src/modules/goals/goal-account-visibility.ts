import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { hasPermissions, type PermissionSubject } from '../../common/authz/request-permissions';
import { Permission } from '../../common/enums/permissions.enum';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';

/**
 * Whether the caller may read accounts. Every member may; an API key or MCP
 * client scoped to goals without `wallet.view` may not, and must not learn a
 * followed account's name or balance through the goal.
 */
export function canReadAccounts(subject: PermissionSubject): boolean {
  return hasPermissions([Permission.WALLET_VIEW], subject);
}

/**
 * The goal answers as a caller without `wallet.view` sees them: `account`
 * becomes null. The progress stays, it is the goal's own figure.
 */
export function withoutAccounts<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(withoutAccounts) as T;
  }
  if (value && typeof value === 'object' && 'account' in value) {
    return { ...value, account: null };
  }
  return value;
}

/** Applies `withoutAccounts` to every answer of the goals routes when the caller may not read accounts. */
@Injectable()
export class GoalAccountVisibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const visible = request.user ? canReadAccounts({ ...request, user: request.user }) : false;
    return visible ? next.handle() : next.handle().pipe(map(withoutAccounts));
  }
}
