import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserTier } from '../users/entities/user.entity';
import { FeatureFlagResponseDto, MyFeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { PatchFeatureFlagDto } from './dto/patch-feature-flag.dto';
import { FeatureFlag as FeatureFlagEntity } from './entities/feature-flag.entity';
import { FeatureFlagsService } from './feature-flags.service';

@ApiTags('feature-flags')
@Controller()
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get('admin/feature-flags')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all feature flags for admins' })
  @ApiResponse({ status: 200, type: FeatureFlagResponseDto, isArray: true })
  getFlags(): Promise<FeatureFlagEntity[]> {
    return this.featureFlagsService.getFlags();
  }

  @Patch('admin/feature-flags/:key')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a feature flag' })
  @ApiResponse({ status: 200, type: FeatureFlagResponseDto })
  patchFlag(
    @Param('key') key: string,
    @Body() dto: PatchFeatureFlagDto,
  ): Promise<FeatureFlagEntity> {
    return this.featureFlagsService.setFlag(decodeURIComponent(key), dto);
  }

  @Get('feature-flags/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve all feature flags for the current user' })
  @ApiResponse({ status: 200, type: MyFeatureFlagResponseDto, isArray: true })
  getMyFlags(
    @CurrentUser('id') userId: string,
    @CurrentUser('tier') tier?: UserTier,
  ): Promise<MyFeatureFlagResponseDto[]> {
    return this.featureFlagsService.getFlagsForUser(userId, tier);
  }
}
