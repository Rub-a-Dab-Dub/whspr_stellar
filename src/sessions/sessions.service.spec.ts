import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { SecurityNotificationsService } from './security-notifications.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: jest.Mocked<SessionsRepository>;
  let notificationsService: jest.Mocked<SecurityNotificationsService>;

  const session = {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'hash',
    deviceInfo: 'Chrome on macOS',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    lastActiveAt: new Date('2026-03-20T08:00:00.000Z'),
    expiresAt: new Date('2026-04-20T08:00:00.000Z'),
    revokedAt: null,
  };

  beforeEach(() => {
    sessionsRepository = {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockResolvedValue(session),
      findById: jest.fn(),
      findActiveByUser: jest.fn(),
      findActiveById: jest.fn(),
      findRecognizedDevice: jest.fn(),
      revoke: jest.fn().mockResolvedValue(true),
      revokeAllExcept: jest.fn().mockResolvedValue(2),
      updateLastActive: jest.fn().mockResolvedValue(undefined),
      deleteExpired: jest.fn().mockResolvedValue(3),
    } as unknown as jest.Mocked<SessionsRepository>;

    notificationsService = {
      sendNewDeviceLoginAlert: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SecurityNotificationsService>;

    service = new SessionsService(sessionsRepository, notificationsService);
  });

  it('creates a session and notifies on an unrecognized device', async () => {
    sessionsRepository.findRecognizedDevice.mockResolvedValue(null);

    const result = await service.createSession({
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      metadata: {
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    expect(result).toBe(session);
    expect(notificationsService.sendNewDeviceLoginAlert).toHaveBeenCalledWith(
      session.userId,
      session.deviceInfo,
      session.ipAddress,
    );
  });

  it('does not notify on a recognized device', async () => {
    sessionsRepository.findRecognizedDevice.mockResolvedValue(session as any);

    await service.createSession({
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      metadata: {
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });

    expect(notificationsService.sendNewDeviceLoginAlert).not.toHaveBeenCalled();
  });

  it('revokes a session owned by the user', async () => {
    sessionsRepository.findById.mockResolvedValue(session as any);

    await service.revokeSession(session.userId, session.id);

    expect(sessionsRepository.revoke).toHaveBeenCalledWith(session.id, expect.any(Date));
  });

  it('rejects revoking a missing session', async () => {
    sessionsRepository.findById.mockResolvedValue(null);

    await expect(service.revokeSession(session.userId, session.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects revoking another user session', async () => {
    sessionsRepository.findById.mockResolvedValue({ ...session, userId: 'user-2' } as any);

    await expect(service.revokeSession(session.userId, session.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('revokes all sessions except the current one', async () => {
    const count = await service.revokeAllSessions(session.userId, session.id);

    expect(count).toBe(2);
    expect(sessionsRepository.revokeAllExcept).toHaveBeenCalledWith(
      session.userId,
      session.id,
      expect.any(Date),
    );
  });

  it('returns active sessions with current-session flags', async () => {
    sessionsRepository.findActiveByUser.mockResolvedValue([
      session,
      { ...session, id: 'session-2' },
    ] as any);

    const result = await service.getActiveSessions(session.userId, session.id);

    expect(result).toEqual([
      expect.objectContaining({ id: session.id, isCurrent: true }),
      expect.objectContaining({ id: 'session-2', isCurrent: false }),
    ]);
  });

  it('cleans up expired sessions', async () => {
    await expect(service.cleanupExpired()).resolves.toBe(3);
    expect(sessionsRepository.deleteExpired).toHaveBeenCalledWith(expect.any(Date));
  });

  it('rejects invalid active sessions', async () => {
    sessionsRepository.findActiveById.mockResolvedValue(null);

    await expect(service.validateActiveSession(session.userId, session.id)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
