import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { FraudDetectionService } from '../fraud-detection.service';
import { BlockIpDto } from '../dto/block-ip.dto';

@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, AdminGuard)
export class FraudDetectionController {
  constructor(private readonly fraud: FraudDetectionService) {}

  @Get('logins')
  getLoginHistory(
    @Query('userId') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.fraud.getLoginHistory(userId, limit);
  }

  @Get('blocked-ips')
  getBlockedIPs() {
    return this.fraud.getBlockedIPs();
  }

  @Post('block-ip')
  async blockIP(@Body() dto: BlockIpDto) {
    await this.fraud.blockIP(dto.ip);
    return { blocked: dto.ip };
  }

  @Delete('block-ip/:ip')
  async unblockIP(@Param('ip') ip: string) {
    await this.fraud.unblockIP(ip);
    return { unblocked: ip };
  }
}
