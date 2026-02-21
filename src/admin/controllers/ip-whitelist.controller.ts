import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { IpWhitelistService } from '../services/ip-whitelist.service';
import { AddIpWhitelistDto } from '../dto/add-ip-whitelist.dto';

@Controller('admin/security/ip-whitelist')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.SUPER_ADMIN)
export class IpWhitelistController {
  constructor(private readonly ipWhitelistService: IpWhitelistService) {}

  @Get()
  async getAll() {
    return this.ipWhitelistService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @Body() dto: AddIpWhitelistDto,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userId = user.id || user.user?.id;
    const ipAddress = this.getClientIp(req);
    return this.ipWhitelistService.create(dto, userId, ipAddress);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const userId = user.id || user.user?.id;
    const ipAddress = this.getClientIp(req);
    await this.ipWhitelistService.remove(id, userId, ipAddress);
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}
