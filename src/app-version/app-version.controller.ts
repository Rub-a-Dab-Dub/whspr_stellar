import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { AppVersionService } from './app-version.service';
import { AppVersionResponseDto, VersionCompatibilityResponseDto } from './dto/app-version-response.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { VersionQueryDto } from './dto/version-query.dto';
import { AppPlatform } from './entities/app-version.entity';

@ApiTags('app version')
@Controller()
export class AppVersionController {
  constructor(private readonly service: AppVersionService) {}

  @Public()
  @Get('app/version')
  @ApiOperation({ summary: 'Get latest published version info for a platform' })
  @ApiQuery({ name: 'platform', enum: AppPlatform })
  @ApiResponse({ status: 200, type: VersionCompatibilityResponseDto })
  async getLatestVersion(
    @Query() query: VersionQueryDto,
    @Headers('x-app-version') currentVersion?: string,
  ): Promise<VersionCompatibilityResponseDto> {
    const latest = await this.service.getLatestVersion(query.platform);
    const compatibility = await this.service.checkCompatibility(
      query.platform,
      currentVersion ?? latest.version,
    );

    if (!compatibility) {
      throw new BadRequestException(`No version information found for platform ${query.platform}`);
    }

    return compatibility;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/app/versions')
  @ApiOperation({ summary: 'Publish a new app version' })
  @ApiResponse({ status: 201, type: AppVersionResponseDto })
  publishVersion(@Body() dto: CreateAppVersionDto): Promise<AppVersionResponseDto> {
    return this.service.publishVersion(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/app/versions/:id')
  @ApiOperation({ summary: 'Update or deprecate an app version' })
  @ApiResponse({ status: 200, type: AppVersionResponseDto })
  async updateVersion(
    @Param('id') id: string,
    @Body() dto: UpdateAppVersionDto,
  ): Promise<AppVersionResponseDto> {
    if (dto.isDeprecated) {
      return this.service.deprecateVersion(id);
    }

    return this.service.updateVersion(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/app/versions')
  @ApiOperation({ summary: 'Get app version history' })
  @ApiQuery({ name: 'platform', enum: AppPlatform, required: false })
  @ApiResponse({ status: 200, type: AppVersionResponseDto, isArray: true })
  getVersionHistory(@Query('platform') platform?: AppPlatform): Promise<AppVersionResponseDto[]> {
    return this.service.getVersionHistory(platform);
  }
}
