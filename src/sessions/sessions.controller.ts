/* eslint-disable @typescript-eslint/no-unsafe-call */
// src/sessions/controllers/session.controller.ts
import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SessionService } from './services/sessions.service';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active sessions for current user' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getActiveSessions(@Req() req: Request) {
    const userId = req.user['sub']; // Extract from JWT payload
    const sessions = await this.sessionService.getActiveSessions(userId);

    return {
      success: true,
      data: sessions.map((session) => ({
        id: session.id,
        deviceType: session.deviceType,
        deviceName: session.deviceName,
        browser: session.browser,
        os: session.os,
        ipAddress: session.ipAddress,
        location: session.location,
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        isCurrent: session.id === req.user['sessionId'], // If you store sessionId in JWT
      })),
      meta: {
        total: sessions.length,
      },
    };
  }

  @Delete(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked successfully' })
  @ApiResponse({
    status: 403,
    description: "Cannot revoke another user's session",
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(@Param('id') sessionId: string, @Req() req: Request) {
    const userId = req.user['sub'];
    await this.sessionService.revokeSession(sessionId, userId);

    return {
      success: true,
      message: 'Session revoked successfully',
    };
  }

  @Delete('revoke-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({
    status: 204,
    description: 'All sessions revoked successfully',
  })
  async revokeAllSessions(@Req() req: Request) {
    const userId = req.user['sub'];
    const currentSessionId = req.user['sessionId']; // If you store sessionId in JWT

    await this.sessionService.revokeAllSessions(userId, currentSessionId);

    return {
      success: true,
      message: 'All other sessions revoked successfully',
    };
  }

  @Delete('revoke-all-including-current')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke all sessions including current (logout everywhere)',
  })
  @ApiResponse({
    status: 204,
    description: 'All sessions revoked successfully',
  })
  async logoutEverywhere(@Req() req: Request) {
    const userId = req.user['sub'];
    await this.sessionService.revokeAllSessions(userId);

    return {
      success: true,
      message: 'Logged out from all devices',
    };
  }
}
