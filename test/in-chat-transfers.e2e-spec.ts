import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Conversation, ConversationType } from '../src/conversations/entities/conversation.entity';
import { ConversationParticipant } from '../src/conversations/entities/conversation-participant.entity';
import { Message } from '../src/messages/entities/message.entity';
import { Transaction, TransactionStatus } from '../src/transactions/entities/transaction.entity';
import {
  InChatTransfer,
  TransferStatus,
} from '../src/in-chat-transfers/entities/in-chat-transfer.entity';
import { InChatTransfersController } from '../src/in-chat-transfers/in-chat-transfers.controller';
import { InChatTransfersService } from '../src/in-chat-transfers/in-chat-transfers.service';
import { SorobanTransfersService } from '../src/in-chat-transfers/soroban-transfers.service';
import { TransfersGateway } from '../src/in-chat-transfers/transfers.gateway';
import { User } from '../src/users/entities/user.entity';
import { UsersRepository } from '../src/users/users.repository';
import { Wallet } from '../src/wallets/entities/wallet.entity';
import { TranslationService } from '../src/i18n/services/translation.service';

type InMemoryStore = {
  conversations: Conversation[];
  participants: ConversationParticipant[];
  messages: Message[];
  transactions: Transaction[];
  transfers: InChatTransfer[];
  users: User[];
  wallets: Wallet[];
};

describe('InChatTransfersController (e2e)', () => {
  let controller: InChatTransfersController;
  let transfersGateway: TransfersGateway;
  let store: InMemoryStore;
  let sorobanMock: {
    estimateFee: jest.Mock;
    submitTransfer: jest.Mock;
  };

  const senderId = '00000000-0000-0000-0000-000000000001';
  const recipientId = '00000000-0000-0000-0000-000000000002';
  const groupRecipientId = '00000000-0000-0000-0000-000000000003';
  const directConversationId = '10000000-0000-0000-0000-000000000001';
  const groupConversationId = '10000000-0000-0000-0000-000000000002';

  beforeEach(async () => {
    sorobanMock = {
      estimateFee: jest.fn().mockResolvedValue('0.0002500'),
      submitTransfer: jest.fn().mockResolvedValue('soroban_test_hash'),
    };

    store = {
      conversations: [
        {
          id: directConversationId,
          type: ConversationType.DIRECT,
          title: 'Direct thread',
          participants: [],
          messages: [],
          transfers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: groupConversationId,
          type: ConversationType.GROUP,
          title: 'Group thread',
          participants: [],
          messages: [],
          transfers: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      participants: [
        makeParticipant(directConversationId, senderId),
        makeParticipant(directConversationId, recipientId),
        makeParticipant(groupConversationId, senderId),
        makeParticipant(groupConversationId, recipientId),
        makeParticipant(groupConversationId, groupRecipientId),
      ],
      messages: [],
      transactions: [],
      transfers: [],
      users: [
        makeUser(senderId, 'sender399', 'sender-wallet'),
        makeUser(recipientId, 'alice399', 'alice-wallet'),
        makeUser(groupRecipientId, 'bob399', 'bob-wallet'),
      ],
      wallets: [
        {
          id: randomUUID(),
          userId: senderId,
          walletAddress: 'sender-primary-wallet',
          network: undefined as never,
          isPrimary: true,
          isVerified: true,
          label: 'primary',
          createdAt: new Date(),
          user: undefined as never,
        },
      ],
    };

    store.participants = store.participants.map((participant) => ({
      ...participant,
      user: store.users.find((user) => user.id === participant.userId)!,
      conversation: store.conversations.find(
        (conversation) => conversation.id === participant.conversationId,
      )!,
    }));

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InChatTransfersController],
      providers: [
        InChatTransfersService,
        TransfersGateway,
        {
          provide: SorobanTransfersService,
          useValue: sorobanMock,
        },
        {
          provide: TranslationService,
          useValue: {
            translate: (key: string) => key,
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            find: jest.fn(({ where }: { where?: { id?: { _value: string[] } } }) => {
              const ids = where?.id?._value ?? [];
              return Promise.resolve(store.users.filter((user) => ids.includes(user.id)));
            }),
            findOne: jest.fn(({ where }: { where: { id: string } }) =>
              Promise.resolve(store.users.find((user) => user.id === where.id) ?? null),
            ),
          },
        },
        repositoryProvider(getRepositoryToken(Conversation), {
          findOne: async ({ where }: { where: { id: string } }) =>
            store.conversations.find((conversation) => conversation.id === where.id) ?? null,
        }),
        repositoryProvider(getRepositoryToken(ConversationParticipant), {
          find: async ({ where }: { where: { conversationId: string } }) =>
            store.participants.filter(
              (participant) => participant.conversationId === where.conversationId,
            ),
        }),
        repositoryProvider(getRepositoryToken(Message), {
          create: (entity: Partial<Message>) => entity,
          save: async (entity: Partial<Message>) => {
            const saved = {
              id: randomUUID(),
              conversationId: entity.conversationId!,
              senderId: entity.senderId ?? null,
              type: entity.type!,
              content: entity.content!,
              createdAt: new Date(),
              conversation: undefined as never,
              sender: undefined as never,
              transfer: null,
            } as Message;
            store.messages.push(saved);
            return saved;
          },
        }),
        repositoryProvider(getRepositoryToken(Transaction), {
          create: (entity: Partial<Transaction>) => entity,
          save: async (entity: Partial<Transaction>) => {
            if (entity.id) {
              const index = store.transactions.findIndex(
                (transaction) => transaction.id === entity.id,
              );
              if (index >= 0) {
                store.transactions[index] = {
                  ...store.transactions[index],
                  ...entity,
                } as Transaction;
                return store.transactions[index];
              }
            }

            const saved = {
              id: randomUUID(),
              senderId: entity.senderId!,
              sender: undefined as never,
              asset: entity.asset!,
              totalAmount: entity.totalAmount!,
              status: entity.status ?? TransactionStatus.SUBMITTED,
              txHash: entity.txHash ?? null,
              errorMessage: entity.errorMessage ?? null,
              transfer: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as Transaction;
            store.transactions.push(saved);
            return saved;
          },
        }),
        repositoryProvider(getRepositoryToken(InChatTransfer), {
          create: (entity: Partial<InChatTransfer>) => entity,
          save: async (entity: Partial<InChatTransfer>) => {
            if (entity.id) {
              const index = store.transfers.findIndex((transfer) => transfer.id === entity.id);
              if (index >= 0) {
                store.transfers[index] = {
                  ...store.transfers[index],
                  ...entity,
                  updatedAt: new Date(),
                } as InChatTransfer;
                return store.transfers[index];
              }
            }

            const saved = {
              id: randomUUID(),
              conversationId: entity.conversationId!,
              conversation: undefined as never,
              senderId: entity.senderId!,
              sender: undefined as never,
              recipientIds: entity.recipientIds ?? [],
              recipientUsernames: entity.recipientUsernames ?? [],
              commandType: entity.commandType!,
              rawCommand: entity.rawCommand!,
              totalAmount: entity.totalAmount!,
              amountPerRecipient: entity.amountPerRecipient!,
              asset: entity.asset!,
              status: entity.status ?? TransferStatus.PENDING_CONFIRMATION,
              feeEstimate: entity.feeEstimate!,
              errorMessage: entity.errorMessage ?? null,
              sorobanTxHash: entity.sorobanTxHash ?? null,
              messageId: entity.messageId ?? null,
              message: null,
              transactionId: entity.transactionId ?? null,
              transaction: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            } as InChatTransfer;
            store.transfers.push(saved);
            return saved;
          },
          findOne: async ({ where }: { where: { id: string } }) =>
            store.transfers.find((transfer) => transfer.id === where.id) ?? null,
          find: async ({ where }: { where: { conversationId: string } }) =>
            store.transfers
              .filter((transfer) => transfer.conversationId === where.conversationId)
              .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
        }),
        repositoryProvider(getRepositoryToken(Wallet), {
          findOne: async ({ where }: { where: { userId: string; isPrimary: boolean } }) =>
            store.wallets.find(
              (wallet) => wallet.userId === where.userId && wallet.isPrimary === where.isPrimary,
            ) ?? null,
        }),
      ],
    }).compile();

    controller = moduleFixture.get(InChatTransfersController);
    transfersGateway = moduleFixture.get(TransfersGateway);
    jest.spyOn(transfersGateway, 'emitTransferInitiated').mockImplementation();
    jest.spyOn(transfersGateway, 'emitTransferCompleted').mockImplementation();
  });

  it('returns a fee estimate before confirmation', async () => {
    const response = await controller.estimateFee({
      asset: 'XLM',
      amount: 10,
      recipientCount: 2,
    });

    expect(response.feeEstimate).toBe('0.0002500');
    expect(sorobanMock.estimateFee).toHaveBeenCalledWith('XLM', '10.0000000', 2);
  });

  it('enforces preview before confirm and creates a transfer message on success', async () => {
    const preview = await controller.initiateTransfer(senderId, directConversationId, {
      rawCommand: '/tip 5 USDC',
    });

    expect(preview.status).toBe('pending_confirmation');
    expect(preview.recipients).toEqual(['alice399']);
    expect(transfersGateway.emitTransferInitiated).toHaveBeenCalled();

    const confirmation = await controller.confirmTransfer(senderId, preview.transferId);

    expect(confirmation.status).toBe('completed');
    expect(confirmation.sorobanTxHash).toBe('soroban_test_hash');
    expect(store.messages.at(-1)?.content).toContain('Sent 5.0000000 USDC to @alice399.');
    expect(transfersGateway.emitTransferCompleted).toHaveBeenCalled();

    await expect(controller.confirmTransfer(senderId, preview.transferId)).rejects.toThrow(
      'Transfer preview must be created before confirmation.',
    );
  });

  it('lists transfers for a conversation', async () => {
    await controller.initiateTransfer(senderId, directConversationId, {
      rawCommand: '/send @alice399 10 XLM',
    });

    const transfers = await controller.listConversationTransfers(directConversationId);

    expect(transfers).toHaveLength(1);
    expect(transfers[0].conversationId).toBe(directConversationId);
  });

  it('shows a failed transfer message in chat when submission fails', async () => {
    sorobanMock.submitTransfer.mockRejectedValueOnce(new Error('simulated submit failure'));

    const preview = await controller.initiateTransfer(senderId, groupConversationId, {
      rawCommand: '/split 30 XLM @alice399 @bob399',
    });

    expect(preview.amountPerRecipient).toBe('15.0000000');

    const confirmation = await controller.confirmTransfer(senderId, preview.transferId);

    expect(confirmation.status).toBe('failed');
    expect(confirmation.errorMessage).toBe('simulated submit failure');
    expect(store.messages.at(-1)?.content).toContain('Transfer failed: simulated submit failure');
  });
});

function makeUser(id: string, username: string, walletAddress: string): User {
  return {
    id,
    username,
    walletAddress,
    email: null,
    displayName: username,
    avatarUrl: null,
    bio: null,
    preferredLocale: null,
    tier: undefined as never,
    isActive: true,
    isVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeParticipant(conversationId: string, userId: string): ConversationParticipant {
  return {
    id: randomUUID(),
    conversationId,
    userId,
    conversation: undefined as never,
    user: undefined as never,
    createdAt: new Date(),
  };
}

function repositoryProvider<T>(provide: ReturnType<typeof getRepositoryToken>, value: T) {
  return {
    provide,
    useValue: value,
  };
}
