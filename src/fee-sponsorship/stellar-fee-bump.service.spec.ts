import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StellarFeeBumpService } from './stellar-fee-bump.service';

const mockSign = jest.fn();
const mockToEnvelope = jest.fn(() => ({ toXDR: () => 'ZmVlYnVtcF94ZHI=' }));

jest.mock('@stellar/stellar-sdk', () => {
  const buildFeeBumpTransaction = jest.fn(() => ({ sign: mockSign, toEnvelope: mockToEnvelope }));
  return {
    Keypair: { fromSecret: jest.fn(() => ({ publicKey: () => 'GSPONSOR' })) },
    Transaction: jest.fn(function MockTx() {
      return { fee: '100' };
    }),
    TransactionBuilder: { buildFeeBumpTransaction },
  };
});

describe('StellarFeeBumpService', () => {
  let service: StellarFeeBumpService;

  beforeEach(async () => {
    mockSign.mockClear();
    mockToEnvelope.mockClear();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarFeeBumpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, def?: string) => {
              if (k === 'SPONSORSHIP_SPONSOR_SECRET') {
                return 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABST3';
              }
              if (k === 'SOROBAN_NETWORK_PASSPHRASE') {
                return 'Test SDF Network ; September 2015';
              }
              return def ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StellarFeeBumpService);
  });

  it('isSponsorConfigured false when secret empty', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarFeeBumpService,
        { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
      ],
    }).compile();
    const s = module.get(StellarFeeBumpService);
    expect(s.isSponsorConfigured()).toBe(false);
  });

  it('buildFeeBumpEnvelopeXdr builds and signs', () => {
    const xdr = service.buildFeeBumpEnvelopeXdr('AAAAAgAAAAB', '500000');
    expect(xdr).toBe('ZmVlYnVtcF94ZHI=');
    expect(mockSign).toHaveBeenCalled();
  });

  it('throws when secret missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarFeeBumpService,
        { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
      ],
    }).compile();
    const s = module.get(StellarFeeBumpService);
    expect(() => s.buildFeeBumpEnvelopeXdr('AAAA', '100')).toThrow(/SPONSORSHIP_SPONSOR_SECRET/);
  });
});
