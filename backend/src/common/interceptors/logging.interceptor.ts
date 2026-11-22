import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import type { RoutedRequest } from '../interfaces/routed-request.interface';
import { loggableUrl } from '../observability/loggable-url';
import { RequestContext } from '../observability/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RoutedRequest>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // A public link carries its secret in the url: such a route logs its pattern.
    const url = loggableUrl(request, isPublic === true);
    const { method } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const delay = Date.now() - now;
        const baseUrl = request.baseUrl || '';
        const routePath = request.route?.path || '';
        const route = routePath ? `${baseUrl}${routePath}` : undefined;

        this.logger.log({
          type: 'http_request',
          method,
          url,
          route,
          statusCode: response.statusCode,
          responseTimeMs: delay,
          requestId: RequestContext.getRequestId(),
          traceId: RequestContext.getTraceId(),
        });
      }),
    );
  }
}
