import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';
import { Networks, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class TokenTransferContractService {
  private readonly logger = new Logger(TokenTransferContractService.name);
  private readonly contractId: string;

  constructor(private readonly sorobanClient: SorobanClientService) {
    this.contractId = process.env.TOKEN_TRANSFER_CONTRACT_ID ?? '';
  }

  async transfer(
    fromId: string,
    toId: string,
    amount: number,
  ): Promise<string> {
    this.logger.log(`Transferring ${amount} tokens from ${fromId} to ${toId}`);

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
          'transfer',
          nativeToScVal(fromId, { type: 'string' }),
          nativeToScVal(toId, { type: 'string' }),
          nativeToScVal(amount, { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async getBalance(userId: string): Promise<number> {
    this.logger.log(`Fetching balance for: ${userId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'balance',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }

  async getTransactionHistory(userId: string): Promise<any[]> {
    this.logger.log(`Fetching transaction history for: ${userId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_history',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }

  async approve(
    ownerId: string,
    spenderId: string,
    amount: number,
  ): Promise<string> {
    this.logger.log(`Approving ${amount} tokens for ${spenderId}`);

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
          'approve',
          nativeToScVal(ownerId, { type: 'string' }),
          nativeToScVal(spenderId, { type: 'string' }),
          nativeToScVal(amount, { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }
}