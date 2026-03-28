import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Message, MessageType } from '../messages/entities/message.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import {
  InChatTransfer,
  TransferCommandType,
  TransferStatus,
} from './entities/in-chat-transfer.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { UsersRepository } from '../users/users.repository';
import { SavedAddressesService } from '../address-book/saved-addresses.service';
import { SorobanTransfersService } from './soroban-transfers.service';
import { InChatTransfersService } from './in-chat-transfers.service';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = <T extends ObjectLiteral>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((entity) => entity),
});

describe('InChatTransfersService', () => {
  let service: InChatTransfersService;
  let conversationsRepository: MockRepository<Conversation>;
  let participantsRepository: MockRepository<ConversationParticipant>;
  let messagesRepository: MockRepository<Message>;
  let transactionsRepository: MockRepository<Transaction>;
  let transfersRepository: MockRepository<InChatTransfer>;
  let walletsRepository: MockRepository<Wallet>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let sorobanTransfersService: jest.Mocked<SorobanTransfersService>;
  let savedAddressesService: jest.Mocked<SavedAddressesService>;

  const senderId = '00000000-0000-0000-0000-000000000001';
  const recipientId = '00000000-0000-0000-0000-000000000002';
  const conversationId = '10000000-0000-0000-0000-000000000000';

  beforeEach(async () => {
    conversationsRepository = createRepositoryMock<Conversation>();
    participantsRepository = createRepositoryMock<ConversationParticipant>();
    messagesRepository = createRepositoryMock<Message>();
    transactionsRepository = createRepositoryMock<Transaction>();
    transfersRepository = createRepositoryMock<InChatTransfer>();
    walletsRepository = createRepositoryMock<Wallet>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InChatTransfersService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: conversationsRepository,
        },
        {
          provide: getRepositoryToken(ConversationParticipant),
          useValue: participantsRepository,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: messagesRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionsRepository,
        },
        {
          provide: getRepositoryToken(InChatTransfer),
          useValue: transfersRepository,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: walletsRepository,
        },
        {
          provide: UsersRepository,
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: SorobanTransfersService,
          useValue: {
            estimateFee: jest.fn(),
            submitTransfer: jest.fn(),
          },
        },
        {
          provide: SavedAddressesService,
          useValue: {
            trackUsageByWalletAddress: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(InChatTransfersService);
    usersRepository = module.get(UsersRepository);
    sorobanTransfersService = module.get(SorobanTransfersService);
    savedAddressesService = module.get(SavedAddressesService);

    jest.clearAllMocks();
  });

  it('parses /send command correctly', () => {
    expect(service.parseTransferCommand('/send @alice 10 XLM')).toEqual({
      commandType: TransferCommandType.SEND,
      mentionedUsernames: ['alice'],
      totalAmount: '10.0000000',
      asset: 'XLM',
    });
  });

  it('parses /tip command without mention correctly', () => {
    expect(service.parseTransferCommand('/tip 5 usdc')).toEqual({
      commandType: TransferCommandType.TIP,
      mentionedUsernames: [],
      totalAmount: '5.0000000',
      asset: 'USDC',
    });
  });

  it('parses /split command and keeps total amount for previewing', () => {
    expect(service.parseTransferCommand('/split 30 XLM @a @b @c')).toEqual({
      commandType: TransferCommandType.SPLIT,
      mentionedUsernames: ['a', 'b', 'c'],
      totalAmount: '30.0000000',
      asset: 'XLM',
    });
  });

  it('throws on invalid command', () => {
    expect(() => service.parseTransferCommand('/invalid')).toThrow(BadRequestException);
  });

  it('creates a preview for /tip without mention in a direct conversation', async () => {
    conversationsRepository.findOne!.mockResolvedValue({ id: conversationId } as Conversation);
    participantsRepository.find!.mockResolvedValue([
      {
        conversationId,
        userId: senderId,
        user: { id: senderId, username: 'sender', walletAddress: 'GSENDER' },
      },
      {
        conversationId,
        userId: recipientId,
        user: { id: recipientId, username: 'alice', walletAddress: 'GALICE' },
      },
    ] as ConversationParticipant[]);
    sorobanTransfersService.estimateFee.mockResolvedValue('0.0002500');
    transfersRepository.save!.mockImplementation(async (entity) => ({
      id: 'transfer-preview-id',
      ...entity,
    }));

    const preview = await service.getTransferPreview(senderId, conversationId, '/tip 5 USDC');

    expect(preview.transferId).toBe('transfer-preview-id');
    expect(preview.recipients).toEqual(['alice']);
    expect(preview.amountPerRecipient).toBe('5.0000000');
    expect(preview.status).toBe(TransferStatus.PENDING_CONFIRMATION);
  });

  it('confirmTransfer throws if transfer is not pending confirmation', async () => {
    transfersRepository.findOne!.mockResolvedValue({
      id: 'transfer-1',
      senderId,
      status: TransferStatus.COMPLETED,
    } as InChatTransfer);

    await expect(service.confirmTransfer('transfer-1', senderId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('confirmTransfer throws for unknown transfer', async () => {
    transfersRepository.findOne!.mockResolvedValue(null);

    await expect(service.confirmTransfer('missing', senderId)).rejects.toThrow(NotFoundException);
  });

  it('confirmTransfer completes and creates a transfer chat message', async () => {
    const transfer = {
      id: 'transfer-1',
      conversationId,
      senderId,
      recipientIds: [recipientId],
      recipientUsernames: ['alice'],
      commandType: TransferCommandType.SEND,
      totalAmount: '10.0000000',
      amountPerRecipient: '10.0000000',
      asset: 'XLM',
      feeEstimate: '0.0001000',
      status: TransferStatus.PENDING_CONFIRMATION,
    } as InChatTransfer;

    transfersRepository.findOne!.mockResolvedValue(transfer);
    transfersRepository.save!.mockImplementation(async (entity) => entity);
    walletsRepository.findOne!.mockResolvedValue({ walletAddress: 'GSENDER' } as Wallet);
    usersRepository.find.mockResolvedValue([
      {
        id: recipientId,
        username: 'alice',
        walletAddress: 'GALICE',
        createdAt: new Date(),
      },
    ] as any);
    transactionsRepository.save!.mockImplementation(async (entity) => ({
      id: 'tx-1',
      ...entity,
    }));
    sorobanTransfersService.submitTransfer.mockResolvedValue('soroban_hash_1');
    messagesRepository.save!.mockImplementation(async (entity) => ({
      id: 'msg-1',
      ...entity,
    }));

    const result = await service.confirmTransfer('transfer-1', senderId);

    expect(result.status).toBe(TransferStatus.COMPLETED);
    expect(result.sorobanTxHash).toBe('soroban_hash_1');
    expect(savedAddressesService.trackUsageByWalletAddress).toHaveBeenCalledWith(
      senderId,
      'GALICE',
    );
    expect(messagesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        type: MessageType.TRANSFER,
      }),
    );
  });

  it('confirmTransfer persists a failed transfer message when submission fails', async () => {
    const transfer = {
      id: 'transfer-1',
      conversationId,
      senderId,
      recipientIds: [recipientId],
      recipientUsernames: ['alice'],
      commandType: TransferCommandType.SEND,
      totalAmount: '10.0000000',
      amountPerRecipient: '10.0000000',
      asset: 'XLM',
      feeEstimate: '0.0001000',
      status: TransferStatus.PENDING_CONFIRMATION,
    } as InChatTransfer;

    transfersRepository.findOne!.mockResolvedValue(transfer);
    transfersRepository.save!.mockImplementation(async (entity) => entity);
    walletsRepository.findOne!.mockResolvedValue({ walletAddress: 'GSENDER' } as Wallet);
    usersRepository.find.mockResolvedValue([
      {
        id: recipientId,
        username: 'alice',
        walletAddress: 'GALICE',
        createdAt: new Date(),
      },
    ] as any);
    transactionsRepository.save!.mockImplementation(async (entity) => ({
      id: 'tx-1',
      ...entity,
    }));
    sorobanTransfersService.submitTransfer.mockRejectedValue(new Error('soroban unavailable'));
    messagesRepository.save!.mockImplementation(async (entity) => ({
      id: 'msg-failed',
      ...entity,
    }));

    const result = await service.confirmTransfer('transfer-1', senderId);

    expect(result.status).toBe(TransferStatus.FAILED);
    expect(result.errorMessage).toBe('soroban unavailable');
    expect(transactionsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TransactionStatus.FAILED,
      }),
    );
    expect(messagesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MessageType.SYSTEM,
        content: expect.stringContaining('Transfer failed'),
      }),
    );
  });
});
