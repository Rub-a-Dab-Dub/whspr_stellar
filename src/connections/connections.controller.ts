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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConnectionsService } from './connections.service';
import {
  ConnectionRequestResponseDto,
  ListConnectionRequestsQueryDto,
  ListConnectionsQueryDto,
  ProfessionalConnectionResponseDto,
  SendConnectionRequestDto,
} from './dto/connection.dto';

/**
 * Professional (mutual) connections — distinct from address-book / device contacts.
 */
@ApiTags('connections')
@ApiBearerAuth()
@Controller('connections')
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a professional connection request with intro (max 300 chars)' })
  @ApiResponse({ status: 201, type: ConnectionRequestResponseDto })
  sendRequest(
    @CurrentUser('id') userId: string,
    @Body() dto: SendConnectionRequestDto,
  ): Promise<ConnectionRequestResponseDto> {
    return this.connectionsService.sendRequest(userId, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List connection requests (incoming by default)' })
  @ApiResponse({ status: 200, type: [ConnectionRequestResponseDto] })
  getRequests(
    @CurrentUser('id') userId: string,
    @Query() query: ListConnectionRequestsQueryDto,
  ): Promise<ConnectionRequestResponseDto[]> {
    return this.connectionsService.getConnectionRequests(userId, query);
  }

  @Patch('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a pending request (receiver only)' })
  @ApiParam({ name: 'id', description: 'Connection request id' })
  @ApiResponse({ status: 200, type: ProfessionalConnectionResponseDto })
  accept(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<ProfessionalConnectionResponseDto> {
    return this.connectionsService.acceptRequest(userId, requestId);
  }

  @Patch('requests/:id/decline')
  @ApiOperation({ summary: 'Decline a pending request (receiver only); 30-day resend cooldown' })
  @ApiParam({ name: 'id', description: 'Connection request id' })
  @ApiResponse({ status: 200, type: ConnectionRequestResponseDto })
  decline(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<ConnectionRequestResponseDto> {
    return this.connectionsService.declineRequest(userId, requestId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw a pending request (sender only)' })
  @ApiParam({ name: 'id', description: 'Connection request id' })
  @ApiResponse({ status: 200, type: ConnectionRequestResponseDto })
  withdraw(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) requestId: string,
  ): Promise<ConnectionRequestResponseDto> {
    return this.connectionsService.withdrawRequest(userId, requestId);
  }

  @Get()
  @ApiOperation({ summary: 'List mutual professional connections; sort by mutualCount or connectedAt' })
  @ApiResponse({ status: 200, type: [ProfessionalConnectionResponseDto] })
  listConnections(
    @CurrentUser('id') userId: string,
    @Query() query: ListConnectionsQueryDto,
  ): Promise<ProfessionalConnectionResponseDto[]> {
    return this.connectionsService.getConnections(userId, query);
  }

  @Get('mutual')
  @ApiOperation({ summary: 'User IDs mutually connected to both you and a connected peer' })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { type: 'string', format: 'uuid' } } })
  mutualWithPeer(
    @CurrentUser('id') userId: string,
    @Query('otherUserId', ParseUUIDPipe) otherUserId: string,
  ): Promise<string[]> {
    return this.connectionsService.getMutualConnections(userId, otherUserId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Number of professional connections for the current user' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async count(@CurrentUser('id') userId: string): Promise<{ count: number }> {
    const count = await this.connectionsService.getConnectionCount(userId);
    return { count };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove mutual professional connection with the given user' })
  @ApiParam({ name: 'userId', description: 'Peer user UUID' })
  remove(
    @CurrentUser('id') userId: string,
    @Param('userId', ParseUUIDPipe) peerUserId: string,
  ): Promise<void> {
    return this.connectionsService.removeConnection(userId, peerUserId);
  }
}
