import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IpWhitelist } from '../entities/ip-whitelist.entity';
import { ConfigService } from '@nestjs/config';
import * as ipaddr from 'ipaddr.js';

@Injectable()
export class IpWhitelistMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(IpWhitelist)
    private readonly ipWhitelistRepo: Repository<IpWhitelist>,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const enabled =
      this.configService.get<string>('ADMIN_IP_WHITELIST_ENABLED') === 'true';

    if (!enabled) {
      return next();
    }

    const whitelist = await this.ipWhitelistRepo.find();

    if (whitelist.length === 0) {
      return next();
    }

    const clientIp = this.getClientIp(req);

    if (!clientIp) {
      throw new ForbiddenException('Unable to determine client IP address');
    }

    const isAllowed = whitelist.some((entry) =>
      this.ipMatchesCidr(clientIp, entry.ipCidr),
    );

    if (!isAllowed) {
      throw new ForbiddenException('IP address not whitelisted');
    }

    next();
  }

  private getClientIp(req: Request): string | null {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      null
    );
  }

  private ipMatchesCidr(ip: string, cidr: string): boolean {
    try {
      const addr = ipaddr.parse(ip);
      const range = ipaddr.parseCIDR(cidr);
      return addr.match(range);
    } catch {
      return false;
    }
  }
}
