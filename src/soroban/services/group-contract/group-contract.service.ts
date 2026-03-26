import { Injectable, Logger } from '@nestjs/common';
import { SorobanClientService } from '../soroban-client/soroban-client.service';
import { Networks, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';

@Injectable()
export class GroupContractService {
  private readonly logger = new Logger(GroupContractService.name);
  private readonly contractId: string;

  constructor(private readonly sorobanClient: SorobanClientService) {
    this.contractId = process.env.GROUP_CONTRACT_ID ?? '';
  }

  async createGroup(
    groupId: string,
    creatorId: string,
    name: string,
  ): Promise<string> {
    this.logger.log(`Creating group: ${name}`);

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
          'create_group',
          nativeToScVal(groupId, { type: 'string' }),
          nativeToScVal(creatorId, { type: 'string' }),
          nativeToScVal(name, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async addMember(
    groupId: string,
    userId: string,
  ): Promise<string> {
    this.logger.log(`Adding member ${userId} to group ${groupId}`);

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
          'add_member',
          nativeToScVal(groupId, { type: 'string' }),
          nativeToScVal(userId, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async removeMember(
    groupId: string,
    userId: string,
  ): Promise<string> {
    this.logger.log(`Removing member ${userId} from group ${groupId}`);

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
          'remove_member',
          nativeToScVal(groupId, { type: 'string' }),
          nativeToScVal(userId, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }

  async getGroup(groupId: string): Promise<any> {
    this.logger.log(`Fetching group: ${groupId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_group',
      [nativeToScVal(groupId, { type: 'string' })],
    );
  }

  async getMembers(groupId: string): Promise<any[]> {
    this.logger.log(`Fetching members for group: ${groupId}`);
    return this.sorobanClient.callView(
      this.contractId,
      'get_members',
      [nativeToScVal(groupId, { type: 'string' })],
    );
  }

  /**
   * View call to on-chain group member (expects `get_member_info` / equivalent on deployed WASM).
   * `chainGroupId` may be a 64-char hex BytesN32 id or a string id, depending on deployment.
   */
  async getMemberInfo(chainGroupId: string, walletAddress: string): Promise<unknown> {
    if (!this.contractId) {
      this.logger.warn('GROUP_CONTRACT_ID is not set; cannot load member info');
      return null;
    }

    const groupScVal = this.chainGroupIdToScVal(chainGroupId);
    const memberScVal = nativeToScVal(walletAddress, { type: 'address' });

    return this.sorobanClient.callView(this.contractId, 'get_member_info', [
      groupScVal,
      memberScVal,
    ]);
  }

  private chainGroupIdToScVal(chainGroupId: string): xdr.ScVal {
    const isHex32 = /^[0-9a-fA-F]{64}$/u;
    if (isHex32.test(chainGroupId)) {
      return xdr.ScVal.scvBytes(Buffer.from(chainGroupId, 'hex'));
    }
    return nativeToScVal(chainGroupId, { type: 'string' });
  }

  async sendGroupMessage(
    groupId: string,
    senderId: string,
    encryptedContent: string,
  ): Promise<string> {
    this.logger.log(`Sending message to group ${groupId}`);

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
          'send_group_message',
          nativeToScVal(groupId, { type: 'string' }),
          nativeToScVal(senderId, { type: 'string' }),
          nativeToScVal(encryptedContent, { type: 'string' }),
        ),
      )
      .setTimeout(30)
      .build();

    const hash = await this.sorobanClient.submitTransaction(tx);
    return this.sorobanClient.pollStatus(hash).then(() => hash);
  }
}