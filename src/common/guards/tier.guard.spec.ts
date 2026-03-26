import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TierGuard } from './tier.guard';
import { UserTier } from '../../users/entities/user.entity';
import { TIER_KEY } from '../decorators/tier.decorator';

describe('TierGuard', () => {
  let guard: TierGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (userTier?: UserTier, requiredTier?: UserTier) => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userTier ? { id: 'user-1', tier: userTier } : null,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValue(requiredTier);
    return context;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TierGuard>(TierGuard);
    reflector = module.get(Reflector);
  });

  it('should allow access if no tier is required', () => {
    const context = mockExecutionContext(UserTier.SILVER, undefined);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has the required tier', () => {
    const context = mockExecutionContext(UserTier.GOLD, UserTier.GOLD);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has a higher tier than required', () => {
    const context = mockExecutionContext(UserTier.BLACK, UserTier.GOLD);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException if user has a lower tier than required', () => {
    const context = mockExecutionContext(UserTier.SILVER, UserTier.GOLD);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should return false if no user is present in request', () => {
    const context = mockExecutionContext(undefined, UserTier.SILVER);
    expect(guard.canActivate(context)).toBe(false);
  });
});
