import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SupportedChain } from './enums/supported-chain.enum';
import { ChainConfig } from './interfaces/chain-config.interface';
import { CHAIN_REGISTRY, CHAIN_ID_MAP } from './constants/chain-registry';

@Injectable()
export class ChainService implements OnModuleInit {
  private readonly logger = new Logger(ChainService.name);
  private providers: Map<SupportedChain, ethers.JsonRpcProvider> = new Map();
  private chainConfigs: Map<SupportedChain, ChainConfig> = new Map();

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.loadChainConfigs();
    this.initializeProviders();
  }

  /**
   * Load chain configurations from env vars, falling back to registry defaults.
   */
  private loadChainConfigs(): void {
    for (const [chain, defaults] of Object.entries(CHAIN_REGISTRY)) {
      const chainKey = chain.toUpperCase();
      const rpcUrl =
        this.configService.get<string>(`CHAIN_${chainKey}_RPC_URL`) ||
        defaults.rpcUrl;
      const contractAddress =
        this.configService.get<string>(`CHAIN_${chainKey}_CONTRACT_ADDRESS`) ||
        defaults.contractAddress;

      this.chainConfigs.set(chain as SupportedChain, {
        ...defaults,
        rpcUrl,
        contractAddress,
      });
    }

    this.logger.log(`Loaded ${this.chainConfigs.size} chain configurations`);
  }

  /**
   * Initialize JSON-RPC providers for each configured chain.
   */
  private initializeProviders(): void {
    for (const [chain, config] of this.chainConfigs.entries()) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl, {
          chainId: config.chainId,
          name: config.name,
        });
        this.providers.set(chain, provider);
        this.logger.log(
          `Initialized provider for ${config.name} (${config.chainId})`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to initialize provider for ${config.name}: ${error.message}`,
        );
      }
    }
  }

  /**
   * Get the JSON-RPC provider for a specific chain.
   */
  getProvider(chain: SupportedChain): ethers.JsonRpcProvider {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new BadRequestException(
        `No provider available for chain: ${chain}`,
      );
    }
    return provider;
  }

  /**
   * Get the full chain configuration for a specific chain.
   */
  getChainConfig(chain: SupportedChain): ChainConfig {
    const config = this.chainConfigs.get(chain);
    if (!config) {
      throw new BadRequestException(`Unsupported chain: ${chain}`);
    }
    return config;
  }

  /**
   * Get all supported chain configurations.
   */
  getAllChains(): { chain: SupportedChain; config: ChainConfig }[] {
    return Array.from(this.chainConfigs.entries()).map(([chain, config]) => ({
      chain,
      config,
    }));
  }

  /**
   * Resolve a SupportedChain enum value from a chain ID.
   */
  getChainByChainId(chainId: number): SupportedChain {
    const chain = CHAIN_ID_MAP[chainId];
    if (!chain) {
      throw new BadRequestException(`Unsupported chain ID: ${chainId}`);
    }
    return chain;
  }

  /**
   * Validate that a chain string is a supported chain.
   */
  validateChain(chain: string): SupportedChain {
    const values = Object.values(SupportedChain) as string[];
    if (!values.includes(chain)) {
      throw new BadRequestException(
        `Unsupported chain: ${chain}. Supported chains: ${values.join(', ')}`,
      );
    }
    return chain as SupportedChain;
  }

  /**
   * Get the GGPay contract instance for a specific chain.
   */
  getContract(chain: SupportedChain): ethers.Contract {
    const config = this.getChainConfig(chain);
    if (!config.contractAddress) {
      throw new BadRequestException(
        `No contract address configured for chain: ${chain}`,
      );
    }

    const provider = this.getProvider(chain);
    const abi = [
      'event PaymentProcessed(address indexed payer, address indexed recipient, uint256 amount, uint256 platformFee, string roomId)',
      'function processPayment(address recipient, string memory roomId) external payable',
      'function platformFeePercentage() external view returns (uint256)',
    ];

    return new ethers.Contract(config.contractAddress, abi, provider);
  }
}
