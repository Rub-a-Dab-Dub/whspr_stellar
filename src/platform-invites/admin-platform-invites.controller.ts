import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  BulkGenerateInvitesDto,
  GeneratePlatformInviteDto,
  InviteStatsResponseDto,
  ListInvitesQueryDto,
  PlatformInviteAdminResponseDto,
  ToggleInviteModeDto,
} from './dto/platform-invite.dto';
import { PlatformInviteService } from './platform-invite.service';

@ApiTags('admin-invites')
@ApiBearerAuth()
@Controller('admin/invites')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminPlatformInvitesController {
  constructor(private readonly platformInviteService: PlatformInviteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single platform invite (optional email delivery)' })
  generate(
    @CurrentUser('id') adminId: string,
    @Body() dto: GeneratePlatformInviteDto,
  ): Promise<PlatformInviteAdminResponseDto> {
    return this.platformInviteService.generateInvite(adminId, dto);
  }

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate many invites at once' })
  generateBulk(
    @CurrentUser('id') adminId: string,
    @Body() dto: BulkGenerateInvitesDto,
  ): Promise<PlatformInviteAdminResponseDto[]> {
    return this.platformInviteService.generateBulk(adminId, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Invite usage statistics' })
  stats(): Promise<InviteStatsResponseDto> {
    return this.platformInviteService.getInviteStats();
  }

  @Get()
  @ApiOperation({ summary: 'List invites with redemption history' })
  list(@Query() query: ListInvitesQueryDto) {
    return this.platformInviteService.getInvites(query);
  }

  @Patch('mode')
  @ApiOperation({ summary: 'Toggle invite-only registration (cached ≤30s propagation)' })
  toggleMode(@Body() dto: ToggleInviteModeDto): Promise<{ inviteModeEnabled: boolean }> {
    return this.platformInviteService.setInviteMode(dto.enabled);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invite' })
  async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.platformInviteService.revokeInvite(id);
  }
}
