import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReputationService } from './reputation.service';
import { RateUserDto } from './dto/rate-user.dto';
import { FlagUserDto } from './dto/flag-user.dto';
import {
  FlagListResponseDto,
  RatingResponseDto,
  ReputationResponseDto,
} from './dto/reputation-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('reputation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Post(':id/rate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Rate a user for a specific conversation (one per conversation)' })
  @ApiParam({ name: 'id', description: 'UUID of the user being rated' })
  @ApiResponse({ status: 201, type: RatingResponseDto })
  @ApiResponse({ status: 409, description: 'Already rated for this conversation' })
  async rateUser(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Body() dto: RateUserDto,
    @Req() req: { user: { id: string } },
  ): Promise<RatingResponseDto> {
    return this.reputationService.rateUser(req.user.id, targetUserId, dto);
  }

  @Get(':id/reputation')
  @ApiOperation({ summary: 'Get reputation score for a user' })
  @ApiParam({ name: 'id', description: 'UUID of the user' })
  @ApiResponse({ status: 200, type: ReputationResponseDto })
  async getReputation(@Param('id', ParseUUIDPipe) userId: string): Promise<ReputationResponseDto> {
    return this.reputationService.getReputation(userId);
  }

  @Post(':id/flag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Flag a user for review' })
  @ApiParam({ name: 'id', description: 'UUID of the user being flagged' })
  @ApiResponse({ status: 200, type: FlagListResponseDto })
  async flagUser(
    @Param('id', ParseUUIDPipe) targetUserId: string,
    @Body() dto: FlagUserDto,
    @Req() req: { user: { id: string } },
  ): Promise<FlagListResponseDto> {
    return this.reputationService.flagUser(req.user.id, targetUserId, dto);
  }

  @Get(':id/flags')
  @ApiOperation({ summary: 'Get flag count and review status for a user' })
  @ApiParam({ name: 'id', description: 'UUID of the user' })
  @ApiResponse({ status: 200, type: FlagListResponseDto })
  async getFlags(@Param('id', ParseUUIDPipe) userId: string): Promise<FlagListResponseDto> {
    return this.reputationService.getFlags(userId);
  }

  @Post(':id/reputation/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger on-chain reputation sync for a user' })
  @ApiParam({ name: 'id', description: 'UUID of the user' })
  @ApiResponse({ status: 200, type: ReputationResponseDto })
  async syncFromChain(@Param('id', ParseUUIDPipe) userId: string): Promise<ReputationResponseDto> {
    return this.reputationService.syncFromChain(userId);
  }
}
