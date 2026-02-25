import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IpBlockService } from './ip-block.service';

@Injectable()
export class IpBlockGuard implements CanActivate {
  constructor(private readonly ipBlockService: IpBlockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress;

    if (ip && (await this.ipBlockService.isBlocked(ip))) {
      throw new ForbiddenException('Your IP address has been blocked.');
    }

    return true;
  }
}
