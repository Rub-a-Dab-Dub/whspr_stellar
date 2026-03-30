import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConsentGuard } from './consent.guard';
import { LegalService } from '../legal.service';

const makeContext = (user: any, handler = {}, cls = {}): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as unknown as ExecutionContext;

describe('ConsentGuard', () => {
  let guard: ConsentGuard;
  let reflector: jest.Mocked<Reflector>;
  let legalService: jest.Mocked<LegalService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConsentGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
        { provide: LegalService, useValue: { requireConsent: jest.fn() } },
      ],
    }).compile();

    guard = module.get(ConsentGuard);
    reflector = module.get(Reflector);
    legalService = module.get(LegalService);
  });

  it('passes through public routes', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)  // isPublic
      .mockReturnValueOnce(false); // skipConsent
    const ctx = makeContext({ id: 'user-uuid' });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(legalService.requireConsent).not.toHaveBeenCalled();
  });

  it('passes through routes marked @SkipConsent', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(true); // skipConsent
    const ctx = makeContext({ id: 'user-uuid' });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(legalService.requireConsent).not.toHaveBeenCalled();
  });

  it('passes through when no user on request (unauthenticated)', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const ctx = makeContext(null);
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(legalService.requireConsent).not.toHaveBeenCalled();
  });

  it('calls requireConsent for authenticated users on protected routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    legalService.requireConsent.mockResolvedValue(undefined);
    const ctx = makeContext({ id: 'user-uuid' });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(legalService.requireConsent).toHaveBeenCalledWith('user-uuid');
  });

  it('propagates ForbiddenException from requireConsent', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    legalService.requireConsent.mockRejectedValue(new Error('Forbidden'));
    const ctx = makeContext({ id: 'user-uuid' });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Forbidden');
  });
});
