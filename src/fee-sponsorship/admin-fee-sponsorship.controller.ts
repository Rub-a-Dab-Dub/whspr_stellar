import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  AdminSponsorshipConfigDto,
  AdminSponsorshipConfigResponseDto,
} from './dto/fee-sponsorship.dto';
import { FeeSponsorshipService } from './fee-sponsorship.service';

@ApiTags('admin-sponsorship')
@ApiBearerAuth()
@Controller('admin/sponsorship')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminFeeSponsorshipController {
  constructor(private readonly feeSponsorshipService: FeeSponsorshipService) {}

  @Post('config')
  @ApiOperation({ summary: 'Configure per-tier monthly sponsorship quotas and new-user window' })
  async configure(@Body() dto: AdminSponsorshipConfigDto): Promise<AdminSponsorshipConfigResponseDto> {
    return this.feeSponsorshipService.configureQuota(dto);
  }
}
