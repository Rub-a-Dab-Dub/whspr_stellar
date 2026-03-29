import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { User } from '../users/entities/user.entity';
import { FeeSponsorship } from './entities/fee-sponsorship.entity';
import { SponsorshipQuota } from './entities/sponsorship-quota.entity';
import { FeeSponsorshipService } from './fee-sponsorship.service';
import { StellarFeeBumpService } from './stellar-fee-bump.service';

const loadAccount = jest.fn();

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn().mockImplementation(() => ({
      loadAccount: (...args: unknown[]) => loadAccount(...args),
    })),
  },
}));

describe('FeeSponsorshipService monitorPlatformFeeAccountBalance', () => {
  let service: FeeSponsorshipService;

  beforeEach(async () => {
    loadAccount.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeSponsorshipService,
        { provide: getRepositoryToken(FeeSponsorship), useValue: {} },
        { provide: getRepositoryToken(SponsorshipQuota), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Referral), useValue: {} },
        { provide: getRepositoryToken(SystemSetting), useValue: {} },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, def?: string | number) => {
              if (k === 'SPONSORSHIP_PLATFORM_ACCOUNT_PUBLIC_KEY') {
                return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
              }
              if (k === 'SPONSORSHIP_LOW_BALANCE_XLM_THRESHOLD') {
                return 100;
              }
              if (k === 'SPONSORSHIP_BALANCE_NETWORK') {
                return 'testnet';
              }
              if (k === 'STELLAR_HORIZON_TESTNET_URL') {
                return 'https://horizon-testnet.stellar.org';
              }
              return def ?? '';
            }),
          },
        },
        { provide: StellarFeeBumpService, useValue: { isSponsorConfigured: () => false } },
      ],
    }).compile();

    service = module.get(FeeSponsorshipService);
  });

  it('warns when balance below threshold', async () => {
    loadAccount.mockResolvedValue({
      balances: [{ asset_type: 'native', balance: '50.0000000' }],
    });
    const w = jest.spyOn((service as any).logger, 'warn').mockImplementation();
    await service.monitorPlatformFeeAccountBalance();
    expect(w).toHaveBeenCalledWith(expect.stringMatching(/ADMIN_ALERT_SPONSORSHIP_LOW_BALANCE/));
    w.mockRestore();
  });

  it('warns when horizon check fails', async () => {
    loadAccount.mockRejectedValue(new Error('network'));
    const w = jest.spyOn((service as any).logger, 'warn').mockImplementation();
    await service.monitorPlatformFeeAccountBalance();
    expect(w).toHaveBeenCalledWith(expect.stringMatching(/Sponsorship balance check failed/));
    w.mockRestore();
  });
});
