import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const isAdmin = req.user?.role?.toLowerCase().includes('admin');

    const active = this.config.get<boolean>('maintenance_mode');

    if (active && !isAdmin) {
      throw new ServiceUnavailableException({
        message: 'The platform is under maintenance',
        estimatedEndAt: this.config.get<Date>('maintenance_end_at'),
      });
    }

    return true;
  }
}
