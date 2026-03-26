import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';
import { Networks, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class TreasuryContractService {
  private readonly logger = new Logger(TreasuryContractService.name);
  private readonly contractId: string;

  constructor(private readonly sorobanClient: SorobanClientService) {
    this.contractId = process.env.TREASURY_CONTRACT_ID ?? '';
  }

  async deposit(
    userId: string,
    amount: number,
  ): Promise<string> {
    this.logger.log(`Depositing ${amount} for user: ${userId}`);

    const account = await this.sorobanClient
      .getServer()
      .getAccount(this.sorobanClient.getKeypair().publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        new (await import('@stellar/stellar-sdk')).Contract(
          this.contractId,
        ).call(
          'deposit',
          nativeToScVal(userId, { type: 'string' }),
          nativeToScVal(amount, { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async withdraw(
    userId: string,
    amount: number,
  ): Promise<string> {
    this.logger.log(`Withdrawing ${amount} for user: ${userId}`);

    const account = await this.sorobanClient
      .getServer()
      .getAccount(this.sorobanClient.getKeypair().publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        new (await import('@stellar/stellar-sdk')).Contract(
          this.contractId,
        ).call(
          'withdraw',
          nativeToScVal(userId, { type: 'string' }),
          nativeToScVal(amount, { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async getTreasuryBalance(): Promise<number> {
    this.logger.log('Fetching treasury balance');
    return this.sorobanClient.callView(
      this.contractId,
      'get_balance',
      [],
    );
  }

  async getUserBalance(userId: string): Promise<number> {
    this.logger.log(`Fetching treasury balance for user: ${userId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_user_balance',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }

  async allocateFunds(
    recipientId: string,
    amount: number,
    reason: string,
  ): Promise<string> {
    this.logger.log(`Allocating ${amount} to ${recipientId}`);

    const account = await this.sorobanClient
      .getServer()
      .getAccount(this.sorobanClient.getKeypair().publicKey());

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        new (await import('@stellar/stellar-sdk')).Contract(
          this.contractId,
        ).call(
          'allocate_funds',
          nativeToScVal(recipientId, { type: 'string' }),
          nativeToScVal(amount, { type: 'i128' }),
          nativeToScVal(reason, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }
}