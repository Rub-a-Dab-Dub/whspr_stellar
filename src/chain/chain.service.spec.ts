import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { ChainService } from './chain.service';
import { SupportedChain } from './enums/supported-chain.enum';
import { CHAIN_REGISTRY } from './constants/chain-registry';

describe('ChainService', () => {
  let service: ChainService;
  let mockConfigService: any;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChainService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ChainService>(ChainService);
    await service.onModuleInit();
  });

  describe('getAllChains', () => {
    it('should return all supported chains', () => {
      const chains = service.getAllChains();

      expect(chains).toHaveLength(Object.keys(CHAIN_REGISTRY).length);
      expect(chains.map((c) => c.chain)).toEqual(
        expect.arrayContaining([
          SupportedChain.ETHEREUM,
          SupportedChain.BNB,
          SupportedChain.CELO,
          SupportedChain.BASE,
        ]),
      );
    });
  });

  describe('getChainConfig', () => {
    it('should return config for a valid chain', () => {
      const config = service.getChainConfig(SupportedChain.ETHEREUM);

      expect(config).toBeDefined();
      expect(config.chainId).toBe(1);
      expect(config.name).toBe('Ethereum');
      expect(config.currency).toBe('ETH');
    });

    it('should return correct config for BNB', () => {
      const config = service.getChainConfig(SupportedChain.BNB);

      expect(config.chainId).toBe(56);
      expect(config.name).toBe('BNB Smart Chain');
      expect(config.currency).toBe('BNB');
    });

    it('should return correct config for Celo', () => {
      const config = service.getChainConfig(SupportedChain.CELO);

      expect(config.chainId).toBe(42220);
      expect(config.name).toBe('Celo');
      expect(config.currency).toBe('CELO');
    });

    it('should return correct config for Base', () => {
      const config = service.getChainConfig(SupportedChain.BASE);

      expect(config.chainId).toBe(8453);
      expect(config.name).toBe('Base');
      expect(config.currency).toBe('ETH');
    });

    it('should throw BadRequestException for unsupported chain', () => {
      expect(() =>
        service.getChainConfig('invalid-chain' as SupportedChain),
      ).toThrow(BadRequestException);
    });
  });

  describe('getChainByChainId', () => {
    it('should resolve chain ID 1 to ethereum', () => {
      const chain = service.getChainByChainId(1);
      expect(chain).toBe(SupportedChain.ETHEREUM);
    });

    it('should resolve chain ID 56 to bnb', () => {
      const chain = service.getChainByChainId(56);
      expect(chain).toBe(SupportedChain.BNB);
    });

    it('should resolve chain ID 42220 to celo', () => {
      const chain = service.getChainByChainId(42220);
      expect(chain).toBe(SupportedChain.CELO);
    });

    it('should resolve chain ID 8453 to base', () => {
      const chain = service.getChainByChainId(8453);
      expect(chain).toBe(SupportedChain.BASE);
    });

    it('should throw BadRequestException for unknown chain ID', () => {
      expect(() => service.getChainByChainId(999)).toThrow(BadRequestException);
    });
  });

  describe('validateChain', () => {
    it('should return the chain for a valid value', () => {
      const result = service.validateChain('ethereum');
      expect(result).toBe(SupportedChain.ETHEREUM);
    });

    it('should return the chain for bnb', () => {
      const result = service.validateChain('bnb');
      expect(result).toBe(SupportedChain.BNB);
    });

    it('should throw BadRequestException for invalid chain string', () => {
      expect(() => service.validateChain('polygon')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getProvider', () => {
    it('should return a provider for a valid chain', () => {
      const provider = service.getProvider(SupportedChain.ETHEREUM);
      expect(provider).toBeDefined();
    });

    it('should throw BadRequestException if provider not available', () => {
      // Clear providers to simulate failure
      (service as any).providers.clear();

      expect(() => service.getProvider(SupportedChain.ETHEREUM)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getContract', () => {
    it('should throw BadRequestException if no contract address configured', () => {
      // Default registry has empty contract addresses
      expect(() => service.getContract(SupportedChain.ETHEREUM)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('config overrides from env', () => {
    it('should use env RPC URL when provided', async () => {
      const customRpc = 'https://custom-rpc.example.com';
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHAIN_ETHEREUM_RPC_URL') return customRpc;
        return undefined;
      });

      // Re-initialize to pick up new config
      await service.onModuleInit();

      const config = service.getChainConfig(SupportedChain.ETHEREUM);
      expect(config.rpcUrl).toBe(customRpc);
    });

    it('should use env contract address when provided', async () => {
      const customContract = '0x1234567890abcdef1234567890abcdef12345678';
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHAIN_BNB_CONTRACT_ADDRESS') return customContract;
        return undefined;
      });

      await service.onModuleInit();

      const config = service.getChainConfig(SupportedChain.BNB);
      expect(config.contractAddress).toBe(customContract);
    });
  });
});
