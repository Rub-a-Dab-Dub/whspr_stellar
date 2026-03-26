import { FeeEstimationController } from './fee-estimation.controller';

describe('FeeEstimationController', () => {
  it('routes to service and returns estimate', async () => {
    const svc: any = {
      estimateTransferFee: jest.fn().mockResolvedValue({ total: 123, breakdown: { networkFee: 100, platformFee: 23 } })
    };
    const ctrl = new FeeEstimationController(svc);
    const res = await ctrl.estimate({ operation: 'transfer', amount: 10, userTier: 'free' } as any);
    expect(res.total).toBe(123);
    expect(svc.estimateTransferFee).toHaveBeenCalled();
  });
});
