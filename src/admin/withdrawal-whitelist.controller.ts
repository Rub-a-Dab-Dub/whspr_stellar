// src/admin/controllers/withdrawal-whitelist.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './auth/guards/admin-auth.guard';
import { WithdrawalWhitelistService } from './services/withdrawal-whitelist.service';
import { CurrentAdmin } from 'src/AdminGuard and Role-based Access Control decorators';
import { User } from 'src/user/entities/user.entity';
import { Chain } from './entities/withdrawal-whitelist.entity';

@Controller('admin/security/withdrawal-whitelist')
@UseGuards(AdminAuthGuard)
export class WithdrawalWhitelistController {
  constructor(private readonly service: WithdrawalWhitelistService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  add(
    @CurrentAdmin() admin: User,
    @Body()
    body: {
      address: string;
      label: string;
      chain: Chain;
      confirmAddress: string;
    },
  ) {
    return this.service.add(admin, body);
  }

  @Patch(':id')
  updateLabel(
    @CurrentAdmin() admin: User,
    @Param('id') id: string,
    @Body('label') label: string,
  ) {
    return this.service.updateLabel(id, label, admin);
  }

  @Delete(':id')
  remove(
    @CurrentAdmin() admin: User,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.service.remove(id, reason, admin, async (address) => {
      // Replace with your pending withdrawal check
      // Return true if pending withdrawal exists
      return false;
    });
  }
}
