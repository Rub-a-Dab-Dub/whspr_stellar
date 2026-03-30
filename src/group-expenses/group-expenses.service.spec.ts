import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { Conversation, ConversationType } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { InChatTransfersService } from '../in-chat-transfers/in-chat-transfers.service';
import { ChatGateway } from '../messaging/gateways/chat.gateway';
import { UsersRepository } from '../users/users.repository';
import { ExpenseSplit } from './entities/expense-split.entity';
import {
  GroupExpense,
  GroupExpenseSplitType,
  GroupExpenseStatus,
} from './entities/group-expense.entity';
import { GroupExpensesService } from './group-expenses.service';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepositoryMock = <T extends ObjectLiteral>(): MockRepository<T> => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn((entity) => entity),
  delete: jest.fn(),
});

describe('GroupExpensesService', () => {
  let service: GroupExpensesService;
  let expensesRepository: MockRepository<GroupExpense>;
  let splitsRepository: MockRepository<ExpenseSplit>;
  let conversationsRepository: MockRepository<Conversation>;
  let participantsRepository: MockRepository<ConversationParticipant>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let inChatTransfersService: jest.Mocked<InChatTransfersService>;
  let chatGateway: jest.Mocked<ChatGateway>;

  const groupId = 'chain-group-1';
  const conversationId = '10000000-0000-0000-0000-000000000011';
  const creatorId = '00000000-0000-0000-0000-000000000001';
  const memberA = '00000000-0000-0000-0000-000000000002';
  const memberB = '00000000-0000-0000-0000-000000000003';

  beforeEach(async () => {
    expensesRepository = createRepositoryMock<GroupExpense>();
    splitsRepository = createRepositoryMock<ExpenseSplit>();
    conversationsRepository = createRepositoryMock<Conversation>();
    participantsRepository = createRepositoryMock<ConversationParticipant>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupExpensesService,
        { provide: getRepositoryToken(GroupExpense), useValue: expensesRepository },
        { provide: getRepositoryToken(ExpenseSplit), useValue: splitsRepository },
        { provide: getRepositoryToken(Conversation), useValue: conversationsRepository },
        {
          provide: getRepositoryToken(ConversationParticipant),
          useValue: participantsRepository,
        },
        {
          provide: UsersRepository,
          useValue: { findOne: jest.fn() },
        },
        {
          provide: InChatTransfersService,
          useValue: { initiateTransfer: jest.fn(), confirmTransfer: jest.fn() },
        },
        {
          provide: ChatGateway,
          useValue: { sendExpenseNew: jest.fn(), sendExpenseSettled: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(GroupExpensesService);
    usersRepository = module.get(UsersRepository);
    inChatTransfersService = module.get(InChatTransfersService);
    chatGateway = module.get(ChatGateway);

    conversationsRepository.findOne!.mockResolvedValue({
      id: conversationId,
      type: ConversationType.GROUP,
      chainGroupId: groupId,
    } as Conversation);
    participantsRepository.find!.mockResolvedValue(
      [creatorId, memberA, memberB].map((userId) => ({ userId })) as ConversationParticipant[],
    );
  });

  it('assigns equal split remainder to creator', async () => {
    expensesRepository.save!
      .mockResolvedValueOnce({
        id: 'expense-1',
        groupId,
        conversationId,
        createdBy: creatorId,
        title: 'Dinner',
        totalAmount: '10.0000000',
        tokenId: 'USDC',
        splitType: GroupExpenseSplitType.EQUAL,
        status: GroupExpenseStatus.OPEN,
        createdAt: new Date(),
      } as GroupExpense)
      .mockResolvedValueOnce({
        id: 'expense-1',
        groupId,
        conversationId,
        createdBy: creatorId,
        title: 'Dinner',
        totalAmount: '10.0000000',
        tokenId: 'USDC',
        splitType: GroupExpenseSplitType.EQUAL,
        status: GroupExpenseStatus.PARTIALLY_SETTLED,
        createdAt: new Date(),
      } as GroupExpense);

    splitsRepository.save!.mockResolvedValue([
      {
        expenseId: 'expense-1',
        userId: creatorId,
        amountOwed: '3.3333334',
        amountPaid: '3.3333334',
        isPaid: true,
        paidAt: new Date(),
      },
      {
        expenseId: 'expense-1',
        userId: memberA,
        amountOwed: '3.3333333',
        amountPaid: '0.0000000',
        isPaid: false,
        paidAt: null,
      },
      {
        expenseId: 'expense-1',
        userId: memberB,
        amountOwed: '3.3333333',
        amountPaid: '0.0000000',
        isPaid: false,
        paidAt: null,
      },
    ] as ExpenseSplit[]);

    const result = await service.createExpense(groupId, creatorId, {
      title: 'Dinner',
      totalAmount: 10,
      tokenId: 'usdc',
      splitType: GroupExpenseSplitType.EQUAL,
    });

    const creatorSplit = result.splits.find((split) => split.userId === creatorId);
    expect(creatorSplit?.amountOwed).toBe('3.3333334');
    expect(chatGateway.sendExpenseNew).toHaveBeenCalled();
  });

  it('rejects custom split when amounts do not sum to total', async () => {
    await expect(
      service.createExpense(groupId, creatorId, {
        title: 'Hotel',
        totalAmount: 10,
        tokenId: 'XLM',
        splitType: GroupExpenseSplitType.CUSTOM,
        splits: [
          { userId: creatorId, amount: 4 },
          { userId: memberA, amount: 4 },
        ],
      }),
    ).rejects.toThrow('Custom split amounts must sum to the expense total.');
  });

  it('returns net owed and owed-to summary per member', async () => {
    expensesRepository.find!.mockResolvedValue([
      {
        id: 'expense-1',
        groupId,
        conversationId,
        createdBy: creatorId,
        title: 'Dinner',
        totalAmount: '30.0000000',
        tokenId: 'USDC',
        splitType: GroupExpenseSplitType.EQUAL,
        status: GroupExpenseStatus.PARTIALLY_SETTLED,
        createdAt: new Date(),
        splits: [
          {
            expenseId: 'expense-1',
            userId: creatorId,
            amountOwed: '10.0000000',
            amountPaid: '10.0000000',
            isPaid: true,
          },
          {
            expenseId: 'expense-1',
            userId: memberA,
            amountOwed: '10.0000000',
            amountPaid: '0.0000000',
            isPaid: false,
          },
          {
            expenseId: 'expense-1',
            userId: memberB,
            amountOwed: '10.0000000',
            amountPaid: '4.0000000',
            isPaid: false,
          },
        ],
      },
    ] as GroupExpense[]);

    const summary = await service.getGroupBalanceSummary(groupId, creatorId);
    expect(summary.find((row) => row.userId === creatorId)?.netOwedTo).toBe('16.0000000');
    expect(summary.find((row) => row.userId === memberA)?.netOwed).toBe('10.0000000');
    expect(summary.find((row) => row.userId === memberB)?.netOwed).toBe('6.0000000');
  });

  it('settles split through transfer and auto-marks paid', async () => {
    expensesRepository.findOne!.mockResolvedValue({
      id: 'expense-1',
      groupId,
      conversationId,
      createdBy: creatorId,
      title: 'Dinner',
      totalAmount: '30.0000000',
      tokenId: 'USDC',
      splitType: GroupExpenseSplitType.EQUAL,
      status: GroupExpenseStatus.PARTIALLY_SETTLED,
      createdAt: new Date(),
      splits: [],
    } as unknown as GroupExpense);
    splitsRepository.findOne!.mockResolvedValue({
      expenseId: 'expense-1',
      userId: memberA,
      amountOwed: '10.0000000',
      amountPaid: '2.0000000',
      isPaid: false,
      paidAt: null,
    } as ExpenseSplit);
    usersRepository.findOne.mockResolvedValue({
      id: creatorId,
      username: 'creator',
    } as never);
    inChatTransfersService.initiateTransfer.mockResolvedValue({
      transferId: 'tr-1',
    } as never);
    inChatTransfersService.confirmTransfer.mockResolvedValue({
      status: 'completed',
    } as never);
    splitsRepository.save!.mockResolvedValue({
      expenseId: 'expense-1',
      userId: memberA,
      amountOwed: '10.0000000',
      amountPaid: '10.0000000',
      isPaid: true,
      paidAt: new Date(),
    } as ExpenseSplit);
    splitsRepository.find!.mockResolvedValue([
      {
        expenseId: 'expense-1',
        userId: creatorId,
        amountOwed: '10.0000000',
        amountPaid: '10.0000000',
        isPaid: true,
      },
      {
        expenseId: 'expense-1',
        userId: memberA,
        amountOwed: '10.0000000',
        amountPaid: '10.0000000',
        isPaid: true,
      },
    ] as ExpenseSplit[]);
    expensesRepository.save!.mockResolvedValue({
      id: 'expense-1',
      groupId,
      conversationId,
      createdBy: creatorId,
      title: 'Dinner',
      totalAmount: '30.0000000',
      tokenId: 'USDC',
      splitType: GroupExpenseSplitType.EQUAL,
      status: GroupExpenseStatus.SETTLED,
      createdAt: new Date(),
      splits: [],
    } as unknown as GroupExpense);

    const result = await service.settleViaTransfer('expense-1', memberA);

    expect(inChatTransfersService.initiateTransfer).toHaveBeenCalledWith(
      memberA,
      conversationId,
      expect.objectContaining({ rawCommand: expect.stringContaining('/send @creator 8.0000000 USDC') }),
    );
    expect(result.status).toBe(GroupExpenseStatus.SETTLED);
    expect(chatGateway.sendExpenseSettled).toHaveBeenCalled();
  });

  it('forbids non-participant from listing expenses', async () => {
    await expect(
      service.getExpenses(groupId, '00000000-0000-0000-0000-000000009999', { page: 1, limit: 10 }),
    ).rejects.toThrow(ForbiddenException);
  });
});
