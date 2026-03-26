import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentSessionId } from './current-session-id.decorator';
import { SessionResponseDto } from './dto/session-response.dto';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'List active sessions for the current user' })
  @ApiResponse({ status: 200, type: SessionResponseDto, isArray: true })
  async getActiveSessions(
    @CurrentUser('id') userId: string,
    @CurrentSessionId() currentSessionId: string,
  ): Promise<SessionResponseDto[]> {
    return this.sessionsService.getActiveSessions(userId, currentSessionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked successfully' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    await this.sessionsService.revokeSession(userId, sessionId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  @ApiResponse({ status: 204, description: 'All other sessions revoked successfully' })
  async revokeAllSessions(
    @CurrentUser('id') userId: string,
    @CurrentSessionId() currentSessionId: string,
  ): Promise<void> {
    await this.sessionsService.revokeAllSessions(userId, currentSessionId);
  }
}
