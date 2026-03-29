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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import {
  LocationShareResponseDto,
  StartLocationShareDto,
  UpdateLocationDto,
} from './dto/location-share.dto';
import { LocationShareService } from './location-share.service';

@ApiTags('live-location')
@ApiBearerAuth()
@Controller()
export class LocationShareController {
  constructor(
    private readonly service: LocationShareService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('conversations/:id/location/share')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start sharing live location in a conversation' })
  @ApiResponse({ status: 201, type: LocationShareResponseDto })
  async startSharing(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: StartLocationShareDto,
  ): Promise<LocationShareResponseDto> {
    const share = await this.service.startSharing(userId, conversationId, dto);
    this.emitLocationUpdate(conversationId, share.id, share.userId, share);
    return share as unknown as LocationShareResponseDto;
  }

  @Patch('location/shares/:id')
  @ApiOperation({ summary: 'Update live location coordinates' })
  @ApiResponse({ status: 200, type: LocationShareResponseDto })
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) shareId: string,
    @Body() dto: UpdateLocationDto,
  ): Promise<LocationShareResponseDto> {
    const share = await this.service.updateLocation(userId, shareId, dto);
    this.emitLocationUpdate(share.conversationId, share.id, share.userId, share);
    return share as unknown as LocationShareResponseDto;
  }

  @Delete('location/shares/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop sharing live location' })
  async stopSharing(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) shareId: string,
  ): Promise<void> {
    await this.service.stopSharing(userId, shareId);
  }

  @Get('conversations/:id/location/shares')
  @ApiOperation({ summary: 'Get active location shares in a conversation' })
  @ApiResponse({ status: 200, type: [LocationShareResponseDto] })
  getActiveShares(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) conversationId: string,
  ): Promise<LocationShareResponseDto[]> {
    return this.service.getActiveShares(userId, conversationId);
  }

  private emitLocationUpdate(
    conversationId: string,
    shareId: string,
    userId: string,
    share: object,
  ): void {
    const roomId = `conversation:${conversationId}`;
    this.chatGateway.server
      ?.to(roomId)
      .emit('location:update', { shareId, userId, ...share, timestamp: Date.now() });
  }
}
