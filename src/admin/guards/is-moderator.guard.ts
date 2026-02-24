import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../../roles/entities/role.entity';

@Injectable()
export class IsModeratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const userObj = user.user || user;
    const roles = userObj?.roles || [];
    const directRole = userObj?.role;

    const isModeratorOrAbove =
      directRole === UserRole.MODERATOR ||
      directRole === UserRole.ADMIN ||
      directRole === UserRole.SUPER_ADMIN ||
      roles.some(
        (role: any) =>
          role.name === UserRole.MODERATOR ||
          role.name === UserRole.ADMIN ||
          role.name === UserRole.SUPER_ADMIN,
      );

    if (!isModeratorOrAbove) {
      throw new ForbiddenException('Moderator access required');
    }

    return true;
  }
}
