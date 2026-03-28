import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SorobanClientService } from './services/soroban-client/soroban-client.service';
import { UserRegistryContractService } from './services/user-registry-contract/user-registry-contract.service';
import { MessagingContractService } from './services/messaging-contract/messaging-contract.service';
import { TokenTransferContractService } from './services/token-transfer-contract/token-transfer-contract.service';
import { GroupContractService } from './services/group-contract/group-contract.service';
import { TreasuryContractService } from './services/treasury-contract/treasury-contract.service';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);

  constructor(
    @InjectQueue('transactions') private readonly transactionQueue: Queue,
    private readonly sorobanClient: SorobanClientService,
    private readonly userRegistry: UserRegistryContractService,
    private readonly messaging: MessagingContractService,
    private readonly tokenTransfer: TokenTransferContractService,
    private readonly group: GroupContractService,
    private readonly treasury: TreasuryContractService,
  ) {}

  async queueTransaction(
    type: string,
    payload: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Queuing transaction of type: ${type}`);
    await this.transactionQueue.add(
      'process',
      { type, payload },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async registerUser(userId: string, publicKey: string): Promise<string> {
    return this.userRegistry.registerUser(userId, publicKey);
  }

  async getUser(userId: string): Promise<any> {
    return this.userRegistry.getUser(userId);
  }

  async isUserRegistered(userId: string): Promise<boolean> {
    return this.userRegistry.isUserRegistered(userId);
  }

  async sendMessage(
    senderId: string,
    receiverId: string,
    encryptedContent: string,
  ): Promise<string> {
    return this.messaging.sendMessage(senderId, receiverId, encryptedContent);
  }

  async getMessages(userId: string): Promise<any[]> {
    return this.messaging.getMessages(userId);
  }

  async getConversation(userA: string, userB: string): Promise<any[]> {
    return this.messaging.getConversation(userA, userB);
  }

  async transfer(
    fromId: string,
    toId: string,
    amount: number,
  ): Promise<string> {
    return this.tokenTransfer.transfer(fromId, toId, amount);
  }

  async getBalance(userId: string): Promise<number> {
    return this.tokenTransfer.getBalance(userId);
  }

  async createGroup(
    groupId: string,
    creatorId: string,
    name: string,
  ): Promise<string> {
    return this.group.createGroup(groupId, creatorId, name);
  }

  async addMember(groupId: string, userId: string): Promise<string> {
    return this.group.addMember(groupId, userId);
  }

  async getGroup(groupId: string): Promise<any> {
    return this.group.getGroup(groupId);
  }

  async getMembers(groupId: string): Promise<any[]> {
    return this.group.getMembers(groupId);
  }

  async deposit(userId: string, amount: number): Promise<string> {
    return this.treasury.deposit(userId, amount);
  }

  async withdraw(userId: string, amount: number): Promise<string> {
    return this.treasury.withdraw(userId, amount);
  }

  async getTreasuryBalance(): Promise<number> {
    return this.treasury.getTreasuryBalance();
  }

  async getUserBalance(userId: string): Promise<number> {
    return this.treasury.getUserBalance(userId);
  }
}