import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ReferralsService } from '../services/referrals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApplyReferralDto } from '../dto/apply-referral.dto';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get referral leaderboard (cached 60s)' })
  @ApiResponse({ status: 200, description: 'Returns top 100 referrers' })
  async getReferralLeaderboard() {
    return this.referralsService.getReferralLeaderboard();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('code')
  @ApiOperation({ summary: 'Get or generate the current user referral code' })
  @ApiResponse({ status: 200, description: 'Returns the referral code' })
  async getCode(@Req() req: any) {
    const code = await this.referralsService.generateCode(req.user.id);
    return { code };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('apply')
  @ApiOperation({ summary: 'Apply a referral code' })
  @ApiResponse({ status: 201, description: 'Referral code successfully applied' })
  async applyCode(@Req() req: any, @Body() dto: ApplyReferralDto) {
    await this.referralsService.applyReferralCode(req.user.id, dto.code);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Get user referrals and total rewards' })
  @ApiResponse({ status: 200, description: 'Returns list of referrals and total rewards' })
  async getReferrals(@Req() req: any) {
    const referrals = await this.referralsService.getReferrals(req.user.id);
    const totalRewards = await this.referralsService.getTotalRewards(req.user.id);
    return {
      referrals,
      totalRewards,
      totalCount: referrals.length,
    };
  }
}
