import { UserTier } from '../../users/entities/user.entity';
import { parseUserTier, userMeetsMinTier } from './staking-tier.util';

describe('staking-tier.util', () => {
  it('parses tiers', () => {
    expect(parseUserTier('gold')).toBe(UserTier.GOLD);
    expect(parseUserTier('invalid')).toBeNull();
  });

  it('compares ranks', () => {
    expect(userMeetsMinTier(UserTier.BLACK, UserTier.GOLD)).toBe(true);
    expect(userMeetsMinTier(UserTier.SILVER, UserTier.GOLD)).toBe(false);
  });
});
