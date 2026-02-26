import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler or controller as publicly accessible.
 * The global JwtAuthGuard will skip authentication for routes
 * decorated with @Public().
 *
 * @example
 * @Public()
 * @Post('nonce')
 * getNonce() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
