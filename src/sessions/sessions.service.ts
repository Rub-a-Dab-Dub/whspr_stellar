import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionResponseDto } from './dto/session-response.dto';
import { UserSession } from './entities/user-session.entity';
import { SecurityNotificationsService } from './security-notifications.service';
import { SessionsRepository } from './sessions.repository';

export type SessionMetadata = {
  deviceInfo: string;
  ipAddress: string | null;
  userAgent: string | null;
};

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly securityNotificationsService: SecurityNotificationsService,
  ) {}

  async createSession(input: {
    id?: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    metadata: SessionMetadata;
  }): Promise<UserSession> {
    const now = new Date();
    const recognizedDevice = await this.sessionsRepository.findRecognizedDevice(
      input.userId,
      input.metadata.deviceInfo,
      input.metadata.userAgent,
    );

    const session = this.sessionsRepository.create({
      id: input.id,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      deviceInfo: input.metadata.deviceInfo,
      ipAddress: input.metadata.ipAddress,
      userAgent: input.metadata.userAgent,
      lastActiveAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    });

    const savedSession = await this.sessionsRepository.save(session);

    if (!recognizedDevice) {
      await this.securityNotificationsService.sendNewDeviceLoginAlert(
        input.userId,
        input.metadata.deviceInfo,
        input.metadata.ipAddress,
      );
    }

    return savedSession;
  }

  async rotateSession(input: {
    nextSessionId?: string;
    userId: string;
    currentSessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    metadata: SessionMetadata;
  }): Promise<UserSession> {
    await this.validateActiveSession(input.userId, input.currentSessionId);
    await this.sessionsRepository.revoke(input.currentSessionId, new Date());

    return this.createSession({
      id: input.nextSessionId,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Session does not belong to the current user');
    }

    await this.sessionsRepository.revoke(sessionId, new Date());
  }

  revokeAllSessions(userId: string, currentSessionId: string): Promise<number> {
    return this.sessionsRepository.revokeAllExcept(userId, currentSessionId, new Date());
  }

  async getActiveSessions(userId: string, currentSessionId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionsRepository.findActiveByUser(userId);
    return sessions.map((session) => this.toResponseDto(session, currentSessionId));
  }

  async cleanupExpired(now: Date = new Date()): Promise<number> {
    const deletedCount = await this.sessionsRepository.deleteExpired(now);
    this.logger.log(`Expired sessions cleanup completed: ${deletedCount}`);
    return deletedCount;
  }

  touchSession(sessionId: string): Promise<void> {
    return this.sessionsRepository.updateLastActive(sessionId, new Date());
  }

  async validateActiveSession(userId: string, sessionId?: string): Promise<void> {
    if (!sessionId) {
      throw new UnauthorizedException('Session context missing');
    }

    const session = await this.sessionsRepository.findActiveById(sessionId, userId);
    if (!session) {
      throw new UnauthorizedException('Session revoked or expired');
    }
  }

  async validateRefreshSession(userId: string, sessionId: string): Promise<UserSession> {
    const session = await this.sessionsRepository.findActiveById(sessionId, userId);
    if (!session) {
      throw new UnauthorizedException('Refresh session not found or expired');
    }

    return session;
  }

  private toResponseDto(session: UserSession, currentSessionId: string): SessionResponseDto {
    return {
      id: session.id,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt,
      isCurrent: session.id === currentSessionId,
    };
  }
}
