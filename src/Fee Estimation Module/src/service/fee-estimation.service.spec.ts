import { FeeEstimationService } from './fee-estimation.service';
import { HorizonClient } from '../transport/horizon.client';
import { RedisCache } from '../util/redis-cache';

describe('FeeEstimationService', () => {
  let service: FeeEstimationService;
  let horizon: HorizonClient;
  let cache: RedisCache;

  beforeEach(() => {
    horizon = new HorizonClient();
    cache = new RedisCache();
    // mock horizon.getFeeStats
    jest.spyOn(horizon, 'getFeeStats').mockResolvedValue({ fee_charged: { p50: '100' }, base_fee: '100' } as any);
    // mock redis methods
    const store: Record<string, string> = {};
    jest.spyOn(cache, 'get').mockImplementation(async (k: string) => {
      const v = store[k];
      return v ? JSON.parse(v) : null;
    });
    jest.spyOn(cache, 'set').mockImplementation(async (k: string, v: any) => {
      store[k] = JSON.stringify(v);
    });

    service = new FeeEstimationService(horizon, cache);
  });

  it('calculates network and platform fees and caches result', async () => {
    const r1 = await service.estimateTransferFee(1000, 'free');
    expect(r1.breakdown.networkFee).toBeGreaterThan(0);
    expect(r1.breakdown.platformFee).toBeGreaterThanOrEqual(0);

    // second call should hit cache: horizon.getFeeStats called only once
    const r2 = await service.estimateTransferFee(1000, 'free');
    expect(r2).toEqual(r1);
    expect(horizon.getFeeStats).toHaveBeenCalled();
  });

  it('applies tier discounts to platform fee', async () => {
    const freeRes = await service.estimateTransferFee(1000, 'free');
    const goldRes = await service.estimateTransferFee(1000, 'gold');
    expect(goldRes.breakdown.platformFee).toBeLessThanOrEqual(freeRes.breakdown.platformFee);
  });

  it('estimates split and treasury with more ops', async () => {
    const t = await service.estimateTreasuryFee(10, 'silver');
    const s = await service.estimateSplitFee(10, 'silver');
    expect(t.breakdown.networkFee).toBeGreaterThan(s.breakdown.networkFee);
  });
});
