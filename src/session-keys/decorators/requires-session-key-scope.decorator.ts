import { SetMetadata } from '@nestjs/common';
import { SessionKeyScope } from '../entities/session-key.entity';
import { SESSION_KEY_SCOPE_KEY } from '../guards/session-key.guard';

/**
 * Marks a route as requiring a specific session key scope when an
 * `x-session-key` header is present.
 *
 * @example
 * @Post('transfer')
 * @RequiresSessionKeyScope(SessionKeyScope.TRANSFER)
 * async createTransfer(...) {}
 */
export const RequiresSessionKeyScope = (scope: SessionKeyScope) =>
  SetMetadata(SESSION_KEY_SCOPE_KEY, scope);
