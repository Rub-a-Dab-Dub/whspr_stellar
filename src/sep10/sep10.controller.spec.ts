import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { Sep10Controller } from './sep10.controller';
import { Sep10Service } from './sep10.service';

describe('Sep10Controller', () => {
  let controller: Sep10Controller;
  let service: jest.Mocked<Sep10Service>;

  const ACCOUNT = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';
  const MOCK_XDR = 'AAAA...base64xdr';
  const MOCK_JWT = 'mock.jwt.token';
  const NETWORK = 'Test SDF Network ; September 2015';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Sep10Controller],
      providers: [
        {
          provide: Sep10Service,
          useValue: {
            buildChallenge: jest.fn().mockReturnValue(MOCK_XDR),
            verifyChallenge: jest.fn().mockReturnValue(MOCK_JWT),
            serverPublicKey: 'GSERVER...',
            tomlHomeDomain: 'example.com',
            tomlWebAuthEndpoint: 'https://example.com/auth',
            networkPassphrase: NETWORK,
          },
        },
      ],
    }).compile();

    controller = module.get(Sep10Controller);
    service = module.get(Sep10Service);
  });

  describe('getStellarToml', () => {
    it('sends TOML content with correct headers', () => {
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      controller.getStellarToml(res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/plain; charset=utf-8');
      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      const body = (res.send as jest.Mock).mock.calls[0][0] as string;
      expect(body).toContain('WEB_AUTH_ENDPOINT');
      expect(body).toContain('SIGNING_KEY');
    });
  });

  describe('getChallenge', () => {
    it('returns transaction XDR and network passphrase', () => {
      const result = controller.getChallenge(ACCOUNT);
      expect(service.buildChallenge).toHaveBeenCalledWith(ACCOUNT);
      expect(result.transaction).toBe(MOCK_XDR);
      expect(result.network_passphrase).toBeDefined();
    });

    it('propagates BadRequestException from service', () => {
      service.buildChallenge.mockImplementation(() => {
        throw new BadRequestException('Invalid account');
      });
      expect(() => controller.getChallenge('INVALID')).toThrow(BadRequestException);
    });
  });

  describe('verifyChallenge', () => {
    it('returns JWT token on valid submission', () => {
      const result = controller.verifyChallenge({ transaction: MOCK_XDR, account: ACCOUNT });
      expect(service.verifyChallenge).toHaveBeenCalledWith(MOCK_XDR, ACCOUNT);
      expect(result.token).toBe(MOCK_JWT);
    });

    it('propagates UnauthorizedException from service', () => {
      service.verifyChallenge.mockImplementation(() => {
        throw new UnauthorizedException('Expired');
      });
      expect(() =>
        controller.verifyChallenge({ transaction: MOCK_XDR, account: ACCOUNT }),
      ).toThrow(UnauthorizedException);
    });
  });
});
