import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Conversation, ConversationType } from '../src/conversations/entities/conversation.entity';
import { ConversationParticipant } from '../src/conversations/entities/conversation-participant.entity';
import { InChatTransfersService } from '../src/in-chat-transfers/in-chat-transfers.service';
import { ChatGateway } from '../src/messaging/gateways/chat.gateway';
import { UsersRepository } from '../src/users/users.repository';
import { ExpenseSplit } from '../src/group-expenses/entities/expense-split.entity';
import {
  GroupExpense,
  GroupExpenseSplitType,
  GroupExpenseStatus,
} from '../src/group-expenses/entities/group-expense.entity';
import { GroupExpensesController } from '../src/group-expenses/group-expenses.controller';
import { GroupExpensesService } from '../src/group-expenses/group-expenses.service';

type InMemoryStore = {
  conversations: Conversation[];
  participants: ConversationParticipant[];
  expenses: GroupExpense[];
  splits: ExpenseSplit[];
};

describe('GroupExpensesController (e2e)', () => {
  let controller: GroupExpensesController;
  let store: InMemoryStore;
  let inChatTransfersMock: {
    initiateTransfer: jest.Mock;
    confirmTransfer: jest.Mock;
  };
  let chatGatewayMock: {
    sendExpenseNew: jest.Mock;
    sendExpenseSettled: jest.Mock;
  };

  const groupId = 'group-chain-id-777';
  const conversationId = '10000000-0000-0000-0000-000000000041';
  const creatorId = '00000000-0000-0000-0000-000000000011';
  const memberA = '00000000-0000-0000-0000-000000000012';
  const memberB = '00000000-0000-0000-0000-000000000013';

  beforeEach(async () => {
    inChatTransfersMock = {
      initiateTransfer: jest.fn().mockResolvedValue({ transferId: 'tr-1' }),
      confirmTransfer: jest.fn().mockResolvedValue({ status: 'completed' }),
    };
    chatGatewayMock = {
      sendExpenseNew: jest.fn().mockResolvedValue(undefined),
      sendExpenseSettled: jest.fn().mockResolvedValue(undefined),
    };

    store = {
      conversations: [
        {
          id: conversationId,
          type: ConversationType.GROUP,
          title: 'Group Conversation',
          chainGroupId: groupId,
          participants: [],
          messages: [],
          transfers: [],
          pinnedMessages: [],
          expenses: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      participants: [
        makeParticipant(conversationId, creatorId),
        makeParticipant(conversationId, memberA),
        makeParticipant(conversationId, memberB),
      ],
      expenses: [],
      splits: [],
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GroupExpensesController],
      providers: [
        GroupExpensesService,
        {
          provide: InChatTransfersService,
          useValue: inChatTransfersMock,
        },
        {
          provide: ChatGateway,
          useValue: chatGatewayMock,
        },
        {
          provide: UsersRepository,
          useValue: {
            findOne: jest.fn(({ where }: { where: { id: string } }) =>
              Promise.resolve({ id: where.id, username: 'creator-settle' }),
            ),
          },
        },
        repositoryProvider(getRepositoryToken(Conversation), {
          findOne: async ({ where }: { where: { chainGroupId: string; type: ConversationType } }) =>
            store.conversations.find(
              (conversation) =>
                conversation.chainGroupId === where.chainGroupId && conversation.type === where.type,
            ) ?? null,
        }),
        repositoryProvider(getRepositoryToken(ConversationParticipant), {
          find: async ({ where }: { where: { conversationId: string } }) =>
            store.participants.filter((participant) => participant.conversationId === where.conversationId),
        }),
        repositoryProvider(getRepositoryToken(GroupExpense), {
          create: (entity: Partial<GroupExpense>) => entity,
          save: async (entity: Partial<GroupExpense>) => {
            if (entity.id) {
              const index = store.expenses.findIndex((expense) => expense.id === entity.id);
              if (index >= 0) {
                store.expenses[index] = {
                  ...store.expenses[index],
                  ...entity,
                } as GroupExpense;
                return store.expenses[index];
              }
            }

            const saved = {
              id: randomUUID(),
              groupId: entity.groupId!,
              conversationId: entity.conversationId!,
              createdBy: entity.createdBy!,
              title: entity.title!,
              totalAmount: entity.totalAmount!,
              tokenId: entity.tokenId!,
              splitType: entity.splitType!,
              status: entity.status ?? GroupExpenseStatus.OPEN,
              createdAt: new Date(),
              splits: [],
            } as unknown as GroupExpense;
            store.expenses.push(saved);
            return saved;
          },
          findOne: async ({ where }: { where: { id: string } }) =>
            store.expenses.find((expense) => expense.id === where.id) ?? null,
          findAndCount: async ({
            where,
            skip,
            take,
          }: {
            where: { groupId: string; status?: GroupExpenseStatus };
            skip: number;
            take: number;
          }) => {
            const filtered = store.expenses
              .filter(
                (expense) =>
                  expense.groupId === where.groupId &&
                  (!where.status || expense.status === where.status),
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
              .slice(skip, skip + take)
              .map((expense) => ({
                ...expense,
                splits: store.splits.filter((split) => split.expenseId === expense.id),
              }));
            const total = store.expenses.filter(
              (expense) =>
                expense.groupId === where.groupId &&
                (!where.status || expense.status === where.status),
            ).length;
            return [filtered, total];
          },
          find: async ({ where }: { where: { groupId: string; status?: GroupExpenseStatus[] } }) => {
            const statuses = where.status ?? [];
            return store.expenses
              .filter(
                (expense) =>
                  expense.groupId === where.groupId &&
                  (statuses.length === 0 || statuses.includes(expense.status)),
              )
              .map((expense) => ({
                ...expense,
                splits: store.splits.filter((split) => split.expenseId === expense.id),
              }));
          },
        }),
        repositoryProvider(getRepositoryToken(ExpenseSplit), {
          create: (entity: Partial<ExpenseSplit>) => entity,
          save: async (entity: Partial<ExpenseSplit> | Partial<ExpenseSplit>[]) => {
            if (Array.isArray(entity)) {
              const saved: ExpenseSplit[] = [];
              for (const row of entity) {
                store.splits = store.splits.filter(
                  (split) => !(split.expenseId === row.expenseId && split.userId === row.userId),
                );
                const next = {
                  expenseId: row.expenseId!,
                  userId: row.userId!,
                  amountOwed: row.amountOwed!,
                  amountPaid: row.amountPaid!,
                  isPaid: row.isPaid!,
                  paidAt: row.paidAt ?? null,
                  expense: undefined as never,
                  user: undefined as never,
                } as ExpenseSplit;
                store.splits.push(next);
                saved.push(next);
              }
              return saved;
            }

            const index = store.splits.findIndex(
              (split) => split.expenseId === entity.expenseId && split.userId === entity.userId,
            );
            const next = {
              ...(index >= 0 ? store.splits[index] : {}),
              ...entity,
              paidAt: entity.paidAt ?? null,
            } as ExpenseSplit;
            if (index >= 0) {
              store.splits[index] = next;
            } else {
              store.splits.push(next);
            }
            return next;
          },
          findOne: async ({ where }: { where: { expenseId: string; userId: string } }) =>
            store.splits.find(
              (split) => split.expenseId === where.expenseId && split.userId === where.userId,
            ) ?? null,
          find: async ({ where }: { where: { expenseId: string } }) =>
            store.splits.filter((split) => split.expenseId === where.expenseId),
          delete: async ({ expenseId }: { expenseId: string }) => {
            store.splits = store.splits.filter((split) => split.expenseId !== expenseId);
            return { affected: 1 };
          },
        }),
      ],
    }).compile();

    controller = moduleFixture.get(GroupExpensesController);
  });

  it('creates equal split expense with creator remainder', async () => {
    const created = await controller.createExpense(groupId, creatorId, {
      title: 'Brunch',
      totalAmount: 10,
      tokenId: 'usdc',
      splitType: GroupExpenseSplitType.EQUAL,
    });

    expect(created.splits).toHaveLength(3);
    expect(created.splits.find((split) => split.userId === creatorId)?.amountOwed).toBe('3.3333334');
  });

  it('lists expenses with status filter and pagination', async () => {
    const openExpense = await controller.createExpense(groupId, creatorId, {
      title: 'Taxi',
      totalAmount: 6,
      tokenId: 'XLM',
      splitType: GroupExpenseSplitType.EQUAL,
    });
    await controller.settleExpense(openExpense.id, memberA);

    const response = await controller.getExpenses(groupId, creatorId, {
      status: GroupExpenseStatus.PARTIALLY_SETTLED,
      page: 1,
      limit: 10,
    });

    expect(response.items).toHaveLength(1);
    expect(response.items[0].status).toBe(GroupExpenseStatus.PARTIALLY_SETTLED);
  });

  it('settle endpoint triggers in-chat transfer and marks split paid', async () => {
    const created = await controller.createExpense(groupId, creatorId, {
      title: 'Dinner',
      totalAmount: 30,
      tokenId: 'USDC',
      splitType: GroupExpenseSplitType.EQUAL,
    });

    const settled = await controller.settleExpense(created.id, memberA);

    const split = settled.splits.find((row) => row.userId === memberA);
    expect(inChatTransfersMock.initiateTransfer).toHaveBeenCalled();
    expect(split?.isPaid).toBe(true);
  });

  it('returns group balance with net owed and owed-to', async () => {
    await controller.createExpense(groupId, creatorId, {
      title: 'Event',
      totalAmount: 30,
      tokenId: 'USDC',
      splitType: GroupExpenseSplitType.EQUAL,
    });

    const balance = await controller.getBalance(groupId, creatorId);

    const creator = balance.summary.find((row) => row.userId === creatorId);
    const member = balance.summary.find((row) => row.userId === memberA);
    expect(creator?.netOwedTo).toBe('20.0000000');
    expect(member?.netOwed).toBe('10.0000000');
  });
});

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

function repositoryProvider<T>(provide: string | Function, value: T) {
  return {
    provide,
    useValue: value,
  };
}
