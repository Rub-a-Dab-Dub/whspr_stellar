export interface ChainConfig {
  name: string;
  rpcUrls: string[];
  contractAddress: string;
}

export class ChainConfigService {
  private configs: Record<string, ChainConfig>;

  constructor() {
    this.configs = {
      BNB: {
        name: "BNB",
        rpcUrls: process.env.BNB_RPC_URLS!.split(","),
        contractAddress: process.env.BNB_CONTRACT!,
      },
      CELO: {
        name: "CELO",
        rpcUrls: process.env.CELO_RPC_URLS!.split(","),
        contractAddress: process.env.CELO_CONTRACT!,
      },
      BASE: {
        name: "BASE",
        rpcUrls: process.env.BASE_RPC_URLS!.split(","),
        contractAddress: process.env.BASE_CONTRACT!,
      },
    };
  }

  getConfig(chain: string): ChainConfig {
    return this.configs[chain];
  }

  getAllChains(): string[] {
    return Object.keys(this.configs);
  }
}
