import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from '@stellar/stellar-sdk';
import { SorobanClientService } from '../../soroban/services/soroban-client/soroban-client.service';

@Injectable()
export class DaoTreasuryContractService {
  private readonly logger = new Logger(DaoTreasuryContractService.name);
  private readonly contractId: string;
  private readonly networkPassphrase: string;

  constructor(
    private readonly sorobanClient: SorobanClientService,
    private readonly config: ConfigService,
  ) {
    this.contractId = this.config.get<string>('DAO_TREASURY_CONTRACT_ID') ?? '';
    this.networkPassphrase =
      this.config.get<string>('STELLAR_NETWORK_PASSPHRASE') ?? Networks.TESTNET;
  }

  async getBalance(groupId: string): Promise<string> {
    const result = await this.sorobanClient.callView(
      this.contractId,
      'get_treasury_balance',
      [nativeToScVal(groupId, { type: 'string' })],
    );
    return String(result ?? '0');
  }

  async deposit(groupId: string, amount: string): Promise<string> {
    return this.invokeContract('deposit', [
      nativeToScVal(groupId, { type: 'string' }),
      nativeToScVal(BigInt(amount), { type: 'i128' }),
    ]);
  }

  async executeProposal(proposalId: string): Promise<string> {
    return this.invokeContract('execute_proposal', [
      nativeToScVal(proposalId, { type: 'string' }),
    ]);
  }

  private async invokeContract(method: string, args: xdr.ScVal[]): Promise<string> {
    const account = await this.sorobanClient
      .getServer()
      .getAccount(this.sorobanClient.getKeypair().publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(new Contract(this.contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    await this.sorobanClient.pollStatus(hash);
    this.logger.log(`${method} confirmed: ${hash}`);
    return hash;
  }
}
