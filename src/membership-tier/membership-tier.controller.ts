import { Controller, Get, Post, UseGuards, Req, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { MembershipTierService } from './membership-tier.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TwoFactorAuthGuard } from '../two-factor/guards/two-factor-auth.guard';
import { UserTier } from '../users/entities/user.entity';
import { TierDetails } from './membership-tier.constants';

@ApiTags('membership-tier')
@Controller('membership-tier')
export class MembershipTierController {
  constructor(private readonly membershipTierService: MembershipTierService) {}

  @Get('benefits')
  @ApiOperation({ summary: 'Get all tiers and their benefits' })
  @ApiResponse({ status: 200, description: 'List of all tiers and benefits' })
  async getAllBenefits(): Promise<TierDetails[]> {
    return this.membershipTierService.getAllTiers();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user tier and benefits' })
  @ApiResponse({ status: 200, description: 'Current user tier details' })
  async getMyTier(@Req() req: any) {
    return this.membershipTierService.getUserTierDetails(req.user.id);
  }

  @UseGuards(JwtAuthGuard, TwoFactorAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: TwoFactorAuthGuard.headerName,
    required: false,
    description: 'Required when the user has 2FA enabled: TOTP or unused backup code',
  })
  @Post('upgrade/:tier')
  @ApiOperation({ summary: 'Request a tier upgrade (Internal/Placeholder for now)' })
  @ApiResponse({ status: 200, description: 'Tier upgrade successful' })
  async upgrade(@Req() req: any, @Param('tier') tier: UserTier) {
    await this.membershipTierService.upgradeTier(req.user.id, tier);
    return { message: `Successfully upgraded to ${tier} tier`, tier };
  }
}
