import { EvmProviderService } from "./evmProvider.service";
import { ChainConfigService } from "./chainConfig.service";

export interface PaymentRecord {
  id: string;
  txHash: string;
  chain: string;
  amount: string;
  tokenAddress: string;
  createdAt: Date;
}

export class PaymentService {
  private records: PaymentRecord[] = [];
  private providerService = new EvmProviderService();
  private configService = new ChainConfigService();

  async verifyAndRecord(txHash: string, amount: string, tokenAddress: string): Promise<PaymentRecord> {
    const chain = await this.providerService.detectChain(txHash);
    if (!chain) throw new Error("Chain not detected");

    const config = this.configService.getConfig(chain);
    if (tokenAddress.toLowerCase() !== config.contractAddress.toLowerCase()) {
      throw new Error("Invalid contract address for chain");
    }

    const record: PaymentRecord = {
      id: crypto.randomUUID(),
      txHash,
      chain,
      amount,
      tokenAddress,
      createdAt: new Date(),
    };
    this.records.push(record);
    return record;
  }
}
