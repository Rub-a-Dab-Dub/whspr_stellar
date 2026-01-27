export interface ChainConfig {
  chainId: number;
  name: string;
  currency: string;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: string;
  isTestnet: boolean;
  blockTime: number; // average block time in seconds
}
