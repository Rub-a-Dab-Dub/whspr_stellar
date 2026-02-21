import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * AdminGuard validates that the incoming request carries a valid admin JWT.
 * Extends Passport's AuthGuard for the 'admin-jwt' strategy and throws
 * ForbiddenException if the token belongs to a non-admin user.
 */
@Injectable()
export class AdminGuard extends AuthGuard('admin-jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: any,
    user: TUser & { isAdmin?: boolean },
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException('Invalid or missing admin token');
    }

    // Ensure the token was issued for an admin account
    if (!(user as any).isAdmin) {
      throw new ForbiddenException(
        'Access denied: token does not belong to an admin account',
      );
    }

    return user;
  }
}
