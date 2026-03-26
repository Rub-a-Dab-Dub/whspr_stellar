import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';
import { Networks, TransactionBuilder, nativeToScVal } from '@stellar/stellar-sdk';

@Injectable()
export class MessagingContractService {
  private readonly logger = new Logger(MessagingContractService.name);
  private readonly contractId: string;

  constructor(private readonly sorobanClient: SorobanClientService) {
    this.contractId = process.env.MESSAGING_CONTRACT_ID ?? '';
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    encryptedContent: string,
  ): Promise<string> {
    this.logger.log(`Sending message from ${senderId} to ${receiverId}`);

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
          'send_message',
          nativeToScVal(senderId, { type: 'string' }),
          nativeToScVal(receiverId, { type: 'string' }),
          nativeToScVal(encryptedContent, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async getMessages(userId: string): Promise<any[]> {
    this.logger.log(`Fetching messages for user: ${userId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_messages',
      [nativeToScVal(userId, { type: 'string' })],
    );
  }

  async getConversation(
    userA: string,
    userB: string,
  ): Promise<any[]> {
    this.logger.log(`Fetching conversation between ${userA} and ${userB}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_conversation',
      [
        nativeToScVal(userA, { type: 'string' }),
        nativeToScVal(userB, { type: 'string' }),
      ],
    );
  }

  async deleteMessage(messageId: string): Promise<string> {
    this.logger.log(`Deleting message: ${messageId}`);

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
          'delete_message',
          nativeToScVal(messageId, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }
}