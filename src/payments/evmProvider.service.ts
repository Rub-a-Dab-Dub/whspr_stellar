import { ethers } from "ethers";
import { ChainConfigService } from "./chainConfig.service";

export class EvmProviderService {
  private configService = new ChainConfigService();

  async getProvider(chain: string): Promise<ethers.JsonRpcProvider> {
    const config = this.configService.getConfig(chain);
    for (const url of config.rpcUrls) {
      try {
        const provider = new ethers.JsonRpcProvider(url);
        await provider.getBlockNumber(); // test connectivity
        return provider;
      } catch {
        console.warn(`RPC failed for ${chain}: ${url}, trying next...`);
      }
    }
    throw new Error(`No RPC available for ${chain}`);
  }

  async detectChain(txHash: string): Promise<string | null> {
    for (const chain of this.configService.getAllChains()) {
      try {
        const provider = await this.getProvider(chain);
        const tx = await provider.getTransaction(txHash);
        if (tx) return chain;
      } catch {
        continue;
      }
    }
    return null;
  }
}
