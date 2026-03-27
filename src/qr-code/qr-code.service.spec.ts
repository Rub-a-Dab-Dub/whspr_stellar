import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as QRCode from 'qrcode';
import { QrCodeService } from './qr-code.service';

jest.mock('qrcode');

const VALID_ADDRESS = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';
const MOCK_PNG = Buffer.from('fakepng');

describe('QrCodeService', () => {
  let service: QrCodeService;
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
    (QRCode.toBuffer as jest.Mock).mockResolvedValue(MOCK_PNG);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrCodeService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(QrCodeService);
  });

  describe('generateWalletQR', () => {
    it('returns PNG buffer', async () => {
      const result = await service.generateWalletQR(VALID_ADDRESS);
      expect(result).toBeInstanceOf(Buffer);
      expect(QRCode.toBuffer).toHaveBeenCalledWith(
        expect.stringContaining(VALID_ADDRESS),
        expect.objectContaining({ type: 'png' }),
      );
    });

    it('returns cached value on second call', async () => {
      cache.get.mockResolvedValue(MOCK_PNG.toString('base64'));
      const result = await service.generateWalletQR(VALID_ADDRESS);
      expect(QRCode.toBuffer).not.toHaveBeenCalled();
      expect(result).toEqual(MOCK_PNG);
    });

    it('stores result in cache', async () => {
      await service.generateWalletQR(VALID_ADDRESS);
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('qr:'),
        expect.any(String),
        3_600_000,
      );
    });
  });

  describe('generateTransferQR', () => {
    it('encodes to, amount, and token in the deep link', async () => {
      await service.generateTransferQR(VALID_ADDRESS, '10.5', 'USDC');
      const call = (QRCode.toBuffer as jest.Mock).mock.calls[0][0] as string;
      expect(call).toContain(`to=${VALID_ADDRESS}`);
      expect(call).toContain('amount=10.5');
      expect(call).toContain('token=USDC');
    });
  });

  describe('generateProfileQR', () => {
    it('encodes username in profile deep link', async () => {
      await service.generateProfileQR('alice');
      const call = (QRCode.toBuffer as jest.Mock).mock.calls[0][0] as string;
      expect(call).toContain('gasless://profile/alice');
    });
  });

  describe('generateGroupQR', () => {
    it('encodes invite code in group deep link', async () => {
      await service.generateGroupQR('invite123');
      const call = (QRCode.toBuffer as jest.Mock).mock.calls[0][0] as string;
      expect(call).toContain('gasless://group/join/invite123');
    });
  });

  describe('parseDeepLink', () => {
    it('parses a pay link with all params', () => {
      const result = service.parseDeepLink(
        `gasless://pay?to=${VALID_ADDRESS}&amount=5&token=USDC`,
      );
      expect(result).toMatchObject({ type: 'pay', to: VALID_ADDRESS, amount: '5', token: 'USDC' });
    });

    it('parses a pay link with only address', () => {
      const result = service.parseDeepLink(`gasless://pay?to=${VALID_ADDRESS}`);
      expect(result).toMatchObject({ type: 'pay', to: VALID_ADDRESS });
    });

    it('parses a group join link', () => {
      const result = service.parseDeepLink('gasless://group/join/abc123');
      expect(result).toMatchObject({ type: 'group_join', inviteCode: 'abc123' });
    });

    it('parses a profile link', () => {
      const result = service.parseDeepLink('gasless://profile/alice');
      expect(result).toMatchObject({ type: 'profile', username: 'alice' });
    });

    it('returns INVALID_SCHEME for wrong scheme', () => {
      const result = service.parseDeepLink('https://example.com') as any;
      expect(result.type).toBe('INVALID_SCHEME');
    });

    it('returns MISSING_PARAM when "to" is absent in pay link', () => {
      const result = service.parseDeepLink('gasless://pay?amount=5') as any;
      expect(result.type).toBe('MISSING_PARAM');
    });

    it('returns INVALID_PARAM for invalid Stellar address', () => {
      const result = service.parseDeepLink('gasless://pay?to=NOTAVALIDADDRESS') as any;
      expect(result.type).toBe('INVALID_PARAM');
    });

    it('returns UNKNOWN_PATH for unrecognised path', () => {
      const result = service.parseDeepLink('gasless://unknown/path') as any;
      expect(result.type).toBe('UNKNOWN_PATH');
    });
  });
});
