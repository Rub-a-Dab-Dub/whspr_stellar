// src/sessions/services/session.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { SessionRepository } from '../repositories/session.repository';
import { RedisSessionService } from './redis-session.service';
import { DeviceParserService } from './device-parser.service';
import { Session } from '../entities/session.entity';

export interface CreateSessionDto {
  userId: string;
  ipAddress: string;
  userAgent: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionService {
  private readonly MAX_SESSIONS_PER_USER: number;
  private readonly SESSION_TTL: number;
  private readonly REFRESH_TOKEN_TTL: number;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly redisSessionService: RedisSessionService,
    private readonly deviceParserService: DeviceParserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.MAX_SESSIONS_PER_USER = this.configService.get<number>(
      'MAX_SESSIONS_PER_USER',
      5,
    );
    this.SESSION_TTL = this.configService.get<number>('SESSION_TTL', 3600); // 1 hour
    this.REFRESH_TOKEN_TTL = this.configService.get<number>(
      'REFRESH_TOKEN_TTL',
      604800,
    ); // 7 days
  }

  async createSession(
    data: CreateSessionDto,
  ): Promise<{ session: Session; tokens: SessionTokens }> {
    // Check concurrent session limit
    const activeSessionCount = await this.sessionRepository.countActiveSessions(
      data.userId,
    );

    if (activeSessionCount >= this.MAX_SESSIONS_PER_USER) {
      // Remove oldest session
      const sessions = await this.sessionRepository.findActiveByUserId(
        data.userId,
      );
      const oldestSession = sessions[sessions.length - 1];
      await this.revokeSession(oldestSession.id, data.userId);
    }

    // Parse device information
    const deviceInfo = this.deviceParserService.parseUserAgent(
      data.userAgent,
      data.ipAddress,
    );
    const location = await this.deviceParserService.parseLocation(
      data.ipAddress,
    );

    // Generate tokens
    const accessToken = this.generateAccessToken(data.userId);
    const refreshToken = this.generateRefreshToken();
    const sessionToken = this.generateSessionToken();

    // Calculate expiration
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_TTL * 1000);

    // Create session in database
    const session = await this.sessionRepository.create({
      token: sessionToken,
      userId: data.userId,
      refreshToken,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      ...deviceInfo,
      location,
      expiresAt,
    });

    // Cache session in Redis
    await this.redisSessionService.setSession(
      sessionToken,
      {
        sessionId: session.id,
        userId: data.userId,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        ipAddress: data.ipAddress,
        expiresAt,
      },
      this.SESSION_TTL,
    );

    return {
      session,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async validateSession(token: string): Promise<Session> {
    // Check Redis first
    const cachedSession = await this.redisSessionService.getSession(token);

    if (cachedSession) {
      // Update last activity
      await this.sessionRepository.updateLastActivity(cachedSession.sessionId);

      // Get full session from database
      const session = await this.sessionRepository.findById(
        cachedSession.sessionId,
      );
      if (!session || !session.isActive) {
        throw new UnauthorizedException('Session is invalid or expired');
      }
      return session;
    }

    // Fallback to database
    const session = await this.sessionRepository.findByToken(token);

    if (!session || !session.isActive) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    // Re-cache in Redis
    await this.redisSessionService.setSession(
      token,
      {
        sessionId: session.id,
        userId: session.userId,
        deviceFingerprint: session.deviceFingerprint,
        ipAddress: session.ipAddress,
        expiresAt: session.expiresAt,
      },
      this.SESSION_TTL,
    );

    return session;
  }

  async refreshSession(refreshToken: string): Promise<SessionTokens> {
    // Find session by refresh token
    const session = await this.sessionRepository.repository.findOne({
      where: { refreshToken, isActive: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (new Date() > session.expiresAt) {
      await this.revokeSession(session.id, session.userId);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(session.userId);
    const newRefreshToken = this.generateRefreshToken();

    // Update session
    await this.sessionRepository.repository.update(session.id, {
      refreshToken: newRefreshToken,
      lastActivity: new Date(),
    });

    // Refresh Redis cache
    await this.redisSessionService.refreshSession(
      session.token,
      this.SESSION_TTL,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.findActiveByUserId(userId);
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException("Cannot revoke another user's session");
    }

    await this.sessionRepository.revokeSession(sessionId);
    await this.redisSessionService.deleteSession(session.token, userId);
  }

  async revokeAllSessions(
    userId: string,
    exceptCurrentSession?: string,
  ): Promise<void> {
    await this.sessionRepository.revokeAllUserSessions(
      userId,
      exceptCurrentSession,
    );
    await this.redisSessionService.deleteAllUserSessions(userId);
  }

  private generateAccessToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, type: 'access' },
      { expiresIn: `${this.SESSION_TTL}s` },
    );
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
