import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Keypair,
  Networks,
  rpc as SorobanRpc,
  Transaction,
  xdr,
  Contract,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

@Injectable()
export class SorobanClientService {
  private readonly logger = new Logger(SorobanClientService.name);
  private server: SorobanRpc.Server;
  private platformKeypair: Keypair;

  constructor(private configService: ConfigService) {
    this.server = new SorobanRpc.Server(
      this.configService.get<string>('SOROBAN_RPC_URL') ??
        'https://soroban-testnet.stellar.org',
    );
    this.platformKeypair = Keypair.fromSecret(
      this.configService.get<string>('PLATFORM_SECRET_KEY') ?? '',
    );
  }

  async submitTransaction(tx: Transaction): Promise<string> {
    try {
      const simResult = await this.server.simulateTransaction(tx);

      if (SorobanRpc.Api.isSimulationError(simResult)) {
        throw new Error(`Simulation failed: ${simResult.error}`);
      }

      const assembled = SorobanRpc.assembleTransaction(tx, simResult).build();
      assembled.sign(this.platformKeypair);

      const result = await this.server.sendTransaction(assembled);
      this.logger.log(`Transaction submitted: ${result.hash}`);
      return result.hash;
    } catch (error) {
        this.logger.error(`Transaction failed: ${(error as Error).message}`);
      throw error;
    }
  }

  async pollStatus(
    txHash: string,
    timeout = 30000,
  ): Promise<SorobanRpc.Api.GetTransactionResponse> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const response = await this.server.getTransaction(txHash);

      if (response.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
        return response;
      }

      await new Promise((res) => setTimeout(res, 2000));
    }

    throw new Error(`Transaction ${txHash} timed out after ${timeout}ms`);
  }

  async callView(
    contractId: string,
    method: string,
    args: xdr.ScVal[] = [],
  ): Promise<any> {
    const contract = new Contract(contractId);
    const operation = contract.call(method, ...args);

    const account = await this.server.getAccount(
      this.platformKeypair.publicKey(),
    );

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      throw new Error(`View call failed: ${simResult.error}`);
    }

    return scValToNative((simResult as any).result?.retval);
  }

  getKeypair(): Keypair {
    return this.platformKeypair;
  }

  getServer(): SorobanRpc.Server {
    return this.server;
  }
}