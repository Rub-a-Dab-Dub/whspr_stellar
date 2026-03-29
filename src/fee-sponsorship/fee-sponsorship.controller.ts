import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeeSponsorshipService } from './fee-sponsorship.service';
import { SponsorshipHistoryResponseDto, SponsorshipQuotaResponseDto } from './dto/fee-sponsorship.dto';

@ApiTags('sponsorship')
@ApiBearerAuth()
@Controller('sponsorship')
@UseGuards(JwtAuthGuard)
export class FeeSponsorshipController {
  constructor(private readonly feeSponsorshipService: FeeSponsorshipService) {}

  @Get('quota')
  @ApiOperation({ summary: 'Remaining monthly sponsored transaction quota' })
  async getQuota(@CurrentUser('id') userId: string): Promise<SponsorshipQuotaResponseDto> {
    return this.feeSponsorshipService.getRemainingQuota(userId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Sponsored fee history for the current user' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<SponsorshipHistoryResponseDto> {
    const p = page ? parseInt(page, 10) : 1;
    const l = limit ? parseInt(limit, 10) : 20;
    return this.feeSponsorshipService.getSponsorshipHistory(userId, p, l);
  }
}
