import { SupportedChain } from '../enums/supported-chain.enum';
import { ChainConfig } from '../interfaces/chain-config.interface';

// Default chain configurations used as fallbacks when env vars are not set
export const CHAIN_REGISTRY: Record<SupportedChain, ChainConfig> = {
  [SupportedChain.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum',
    currency: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    contractAddress: '',
    isTestnet: false,
    blockTime: 12,
  },
  [SupportedChain.BNB]: {
    chainId: 56,
    name: 'BNB Smart Chain',
    currency: 'BNB',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    contractAddress: '',
    isTestnet: false,
    blockTime: 3,
  },
  [SupportedChain.CELO]: {
    chainId: 42220,
    name: 'Celo',
    currency: 'CELO',
    rpcUrl: 'https://forno.celo.org',
    explorerUrl: 'https://celoscan.io',
    contractAddress: '',
    isTestnet: false,
    blockTime: 5,
  },
  [SupportedChain.BASE]: {
    chainId: 8453,
    name: 'Base',
    currency: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    contractAddress: '',
    isTestnet: false,
    blockTime: 2,
  },
};

// Map chain IDs to SupportedChain enum values for reverse lookups
export const CHAIN_ID_MAP: Record<number, SupportedChain> = Object.entries(
  CHAIN_REGISTRY,
).reduce(
  (map, [chain, config]) => {
    map[config.chainId] = chain as SupportedChain;
    return map;
  },
  {} as Record<number, SupportedChain>,
);
