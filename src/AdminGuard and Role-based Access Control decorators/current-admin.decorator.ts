import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the authenticated admin user from the request object.
 * Usage: @CurrentAdmin() admin: AdminUser
 */
export const CurrentAdmin = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const admin = request.user;
    return data ? admin?.[data] : admin;
  },
);
