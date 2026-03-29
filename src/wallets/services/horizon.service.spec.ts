import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HorizonService } from './horizon.service';
import { TranslationService } from '../../i18n/services/translation.service';
import { WalletNetwork } from '../entities/wallet.entity';

describe('HorizonService', () => {
  const config = { get: jest.fn().mockReturnValue('https://horizon-testnet.stellar.org') };
  const translation = { translate: jest.fn((k: string) => k) };

  it('getBalancesOrEmpty returns empty array when getBalances throws NotFoundException', async () => {
    const svc = new HorizonService(config as unknown as ConfigService, translation as unknown as TranslationService);
    jest.spyOn(svc, 'getBalances').mockRejectedValue(new NotFoundException('missing'));
    await expect(svc.getBalancesOrEmpty('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', WalletNetwork.STELLAR_TESTNET)).resolves.toEqual([]);
  });

  it('getBalancesOrEmpty rethrows non-404 errors', async () => {
    const svc = new HorizonService(config as unknown as ConfigService, translation as unknown as TranslationService);
    jest.spyOn(svc, 'getBalances').mockRejectedValue(new Error('network'));
    await expect(
      svc.getBalancesOrEmpty('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', WalletNetwork.STELLAR_TESTNET),
    ).rejects.toThrow('network');
  });
});
