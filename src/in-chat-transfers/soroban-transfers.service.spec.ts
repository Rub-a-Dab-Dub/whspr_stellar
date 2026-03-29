import { Test, TestingModule } from '@nestjs/testing';
import { FeeSponsorshipService } from '../fee-sponsorship/fee-sponsorship.service';
import { SorobanTransfersService } from './soroban-transfers.service';

describe('SorobanTransfersService', () => {
  it('submitTransfer without sponsorship service returns hash', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SorobanTransfersService],
    }).compile();
    const service = module.get(SorobanTransfersService);
    const h = await service.submitTransfer({
      senderAddress: 'G1',
      recipientAddresses: ['G2'],
      asset: 'XLM',
      amountPerRecipient: '1',
      totalAmount: '1',
    });
    expect(h).toMatch(/^soroban_xlm_/);
  });

  it('submitTransfer with sponsor context calls tryConsumeSponsorshipSlot', async () => {
    const feeSponsorship = { tryConsumeSponsorshipSlot: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanTransfersService,
        { provide: FeeSponsorshipService, useValue: feeSponsorship },
      ],
    }).compile();
    const service = module.get(SorobanTransfersService);
    const h = await service.submitTransfer(
      {
        senderAddress: 'G1',
        recipientAddresses: ['G2'],
        asset: 'USDC',
        amountPerRecipient: '5',
        totalAmount: '5',
      },
      { userId: 'user-1' },
    );
    expect(h).toMatch(/^soroban_usdc_/);
    expect(feeSponsorship.tryConsumeSponsorshipSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        txHash: h,
        tokenId: 'USDC',
      }),
    );
  });
});
