import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from '../audit-log.service';
import { AUDIT_ACTION_KEY, AuditActionMeta } from '../decorators/audit-action.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );

    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const actorId: string | null = request.user?.id ?? null;
    const targetId: string | null = request.params?.id ?? null;
    const ipAddress: string | null =
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip ?? null;
    const userAgent: string | null = request.headers['user-agent'] ?? null;

    return next.handle().pipe(
      tap(() => {
        void this.auditLogService.log({
          actorId,
          targetId,
          action: meta.action,
          resource: meta.resource,
          resourceId: targetId,
          ipAddress,
          userAgent,
          metadata: {
            method: request.method,
            path: request.path,
            params: request.params,
            query: request.query,
          },
        });
      }),
    );
  }
}
