import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../roles/entities/role.entity';

@Injectable()
export class IsAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Support both direct user object and user.user structure (common in some JWT strategies)
    const userObj = user.user || user;
    const roles = userObj?.roles || [];
    const directRole = userObj?.role;

    const isAdmin = 
      directRole === UserRole.ADMIN || 
      directRole === UserRole.SUPER_ADMIN ||
      roles.some((role: any) => role.name === UserRole.ADMIN || role.name === UserRole.SUPER_ADMIN);

    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
