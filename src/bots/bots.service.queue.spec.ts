import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue, Worker } from 'bullmq';
import { BotsService } from './bots.service';
import { BotsRepository } from './bots.repository';
import { BotCommandsRepository } from './bot-commands.repository';
import { BotGroupMember } from './entities/bot-group-member.entity';

type JobProcessor = (job: { data: Record<string, unknown> }) => Promise<void>;

var queueAddMock: jest.Mock;
var queueCloseMock: jest.Mock;
var workerCloseMock: jest.Mock;
var workerProcessor: JobProcessor;

jest.mock('bullmq', () => {
  queueAddMock = jest.fn();
  queueCloseMock = jest.fn();
  workerCloseMock = jest.fn();
  workerProcessor = async () => {};

  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: queueAddMock,
      close: queueCloseMock,
    })),
    Worker: jest.fn().mockImplementation((_name: string, processor: JobProcessor) => {
      workerProcessor = processor;
      return {
        close: workerCloseMock,
      };
    }),
  };
});

describe('BotsService queue mode', () => {
  let service: BotsService;
  let botGroupMembersRepository: jest.Mocked<Repository<BotGroupMember>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BotsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback: unknown) => {
              if (key === 'BOTS_QUEUE_ENABLED') {
                return true;
              }
              return fallback;
            }),
          },
        },
        {
          provide: BotsRepository,
          useValue: {
            findOwnedBot: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: BotCommandsRepository,
          useValue: {},
        },
        {
          provide: getRepositoryToken(BotGroupMember),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BotsService);
    botGroupMembersRepository = module.get(getRepositoryToken(BotGroupMember));
  });

  it('queues group events with BullMQ when queue mode is enabled', async () => {
    botGroupMembersRepository.find.mockResolvedValue([
      {
        groupId: 'group-1',
        botId: 'bot-1',
        bot: { isActive: true },
      },
    ] as unknown as BotGroupMember[]);

    await service.dispatchEvent('group-1', 'group.message.created', { messageId: 'msg-1' });

    expect(Queue).toHaveBeenCalled();
    expect(Worker).toHaveBeenCalled();
    expect(queueAddMock).toHaveBeenCalledWith('dispatch-group-event', {
      groupId: 'group-1',
      botId: 'bot-1',
      eventType: 'group.message.created',
      payload: { messageId: 'msg-1' },
    });
  });

  it('worker processor dispatches webhook for active group membership', async () => {
    botGroupMembersRepository.findOne.mockResolvedValue({
      groupId: 'group-1',
      botId: 'bot-1',
      bot: {
        id: 'bot-1',
        isActive: true,
        webhookUrl: 'https://example.com/bot',
        webhookSecret: 'secret',
      },
    } as unknown as BotGroupMember);
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      headers: { get: () => null },
    });

    await workerProcessor({
      data: {
        groupId: 'group-1',
        botId: 'bot-1',
        eventType: 'group.message.created',
        payload: { messageId: 'msg-1' },
      },
    });

    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalled();
  });

  it('does not dispatch webhook when bot is removed from group before job is processed', async () => {
    botGroupMembersRepository.findOne.mockResolvedValue(null);
    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn();

    await workerProcessor({
      data: {
        groupId: 'group-1',
        botId: 'bot-1',
        eventType: 'group.message.created',
        payload: { messageId: 'msg-1' },
      },
    });

    expect((global as unknown as { fetch: jest.Mock }).fetch).not.toHaveBeenCalled();
  });

  it('closes BullMQ queue and worker on module destroy', async () => {
    await service.onModuleDestroy();
    expect(queueCloseMock).toHaveBeenCalled();
    expect(workerCloseMock).toHaveBeenCalled();
  });
});
