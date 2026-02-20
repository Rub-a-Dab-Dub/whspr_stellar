import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RoleType } from '../../roles/entities/role.entity';

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

    const isAdmin = roles.some((role: any) => role.name === RoleType.ADMIN);

    if (!isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
