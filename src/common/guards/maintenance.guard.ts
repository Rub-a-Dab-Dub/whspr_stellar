import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdminService } from '../../admin/services/admin.service';
import { UserRole } from '../../roles/entities/role.entity';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMaintenance = await this.adminService.getConfigValue<boolean>(
      'maintenance_mode',
      false,
    );

    if (!isMaintenance) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Support both direct user object and user.user structure
    const userObj = user?.user || user;
    const roles = userObj?.roles || [];
    const directRole = userObj?.role;

    const isAdmin =
      directRole === UserRole.ADMIN ||
      directRole === UserRole.SUPER_ADMIN ||
      roles.some(
        (role: any) =>
          role.name === UserRole.ADMIN || role.name === UserRole.SUPER_ADMIN,
      );

    if (isAdmin) {
      return true;
    }

    throw new ServiceUnavailableException(
      'Platform is currently under maintenance. Please try again later.',
    );
  }
}
