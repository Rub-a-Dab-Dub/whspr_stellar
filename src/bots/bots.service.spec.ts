import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac } from 'crypto';
import { BotsService } from './bots.service';
import { BotsRepository } from './bots.repository';
import { BotCommandsRepository } from './bot-commands.repository';
import { BotGroupMember } from './entities/bot-group-member.entity';
import { Bot } from './entities/bot.entity';

describe('BotsService', () => {
  let service: BotsService;
  let botsRepository: jest.Mocked<BotsRepository>;
  let botCommandsRepository: jest.Mocked<BotCommandsRepository>;
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
                return false;
              }
              return fallback;
            }),
          },
        },
        {
          provide: BotsRepository,
          useValue: {
            exist: jest.fn(),
            create: jest.fn((entity) => entity),
            save: jest.fn(),
            findByOwner: jest.fn(),
            findOwnedBot: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: BotCommandsRepository,
          useValue: {
            replaceForBot: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BotGroupMember),
          useValue: {
            create: jest.fn((entity) => entity),
            save: jest.fn(),
            delete: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BotsService);
    botsRepository = module.get(BotsRepository);
    botCommandsRepository = module.get(BotCommandsRepository);
    botGroupMembersRepository = module.get(getRepositoryToken(BotGroupMember));
  });

  it('creates a bot with commands', async () => {
    botsRepository.exist.mockResolvedValue(false);
    botsRepository.save.mockResolvedValue({
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Notifier',
      username: 'notifier_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com/webhook',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot);
    botsRepository.findOwnedBot.mockResolvedValue({
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Notifier',
      username: 'notifier_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com/webhook',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [{ command: '/help', description: 'Show help', usage: '/help' }],
      groupMemberships: [],
    } as unknown as Bot);

    const created = await service.createBot('owner-1', {
      name: 'Notifier',
      username: 'notifier_bot',
      webhookUrl: 'https://example.com/webhook',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      commands: [{ command: '/help', description: 'Show help', usage: '/help' }],
    });

    expect(created.id).toBe('bot-1');
    expect(botCommandsRepository.replaceForBot).toHaveBeenCalledWith('bot-1', [
      { command: '/help', description: 'Show help', usage: '/help' },
    ]);
  });

  it('adds bots to a group as isBot participant', async () => {
    botsRepository.findOwnedBot.mockResolvedValue({
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Helper',
      username: 'helper_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com',
      webhookSecret: 'secret',
      scopes: ['commands:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot);
    botGroupMembersRepository.findOne.mockResolvedValue(null);

    const result = await service.addToGroup('owner-1', 'group-1', 'bot-1');

    expect(result).toEqual({
      groupId: 'group-1',
      botId: 'bot-1',
      name: 'Helper',
      username: 'helper_bot',
      avatarUrl: null,
      isBot: true,
    });
    expect(botGroupMembersRepository.save).toHaveBeenCalled();
  });

  it('returns bot commands through /help', async () => {
    botGroupMembersRepository.find.mockResolvedValue([
      {
        groupId: 'group-1',
        bot: {
          isActive: true,
          commands: [{ command: '/ping', description: 'Ping bot', usage: '/ping' }],
        },
      },
    ] as unknown as BotGroupMember[]);

    const help = await service.processCommand('group-1', '/help');

    expect(help).toContain('Available bot commands:');
    expect(help).toContain('/ping - Ping bot');
  });

  it('validates HMAC signature on bot webhook response', async () => {
    const secret = 'top-secret';
    const responsePayload = JSON.stringify({ ok: true });
    const validSignature = createHmac('sha256', secret).update(responsePayload).digest('hex');

    botsRepository.findOwnedBot.mockResolvedValue({
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Verifier',
      username: 'verifier_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com',
      webhookSecret: secret,
      scopes: ['events:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot);
    botGroupMembersRepository.find.mockResolvedValue([
      {
        groupId: 'group-1',
        botId: 'bot-1',
        bot: {
          id: 'bot-1',
          ownerId: 'owner-1',
          name: 'Verifier',
          username: 'verifier_bot',
          avatarUrl: null,
          webhookUrl: 'https://example.com',
          webhookSecret: secret,
          scopes: ['events:read'],
          isActive: true,
          createdAt: new Date(),
          commands: [],
          groupMemberships: [],
        },
      },
    ] as unknown as BotGroupMember[]);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => responsePayload,
      headers: {
        get: (name: string) => (name === 'x-whspr-signature' ? validSignature : null),
      },
    });
    (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;

    await service.dispatchEvent('group-1', 'group.message.created', { messageId: 'msg-1' });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when bot response signature is invalid', async () => {
    botGroupMembersRepository.find.mockResolvedValue([
      {
        groupId: 'group-1',
        botId: 'bot-1',
        bot: {
          id: 'bot-1',
          ownerId: 'owner-1',
          name: 'Verifier',
          username: 'verifier_bot',
          avatarUrl: null,
          webhookUrl: 'https://example.com',
          webhookSecret: 'secret',
          scopes: ['events:read'],
          isActive: true,
          createdAt: new Date(),
          commands: [],
          groupMemberships: [],
        },
      },
    ] as unknown as BotGroupMember[]);

    (global as unknown as { fetch: typeof fetch }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
      headers: {
        get: () => '00deadbeef',
      },
    });

    await expect(
      service.dispatchEvent('group-1', 'group.message.created', { messageId: 'msg-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists user bots', async () => {
    botsRepository.findByOwner.mockResolvedValue([
      {
        id: 'bot-1',
        ownerId: 'owner-1',
        name: 'List Bot',
        username: 'list_bot',
        avatarUrl: null,
        webhookUrl: 'https://example.com',
        webhookSecret: 'secret',
        scopes: ['messages:read'],
        isActive: true,
        createdAt: new Date(),
        commands: [],
        groupMemberships: [],
      } as unknown as Bot,
    ]);

    const bots = await service.getBots('owner-1');
    expect(bots).toHaveLength(1);
    expect(bots[0].username).toBe('list_bot');
  });

  it('updates a bot and replaces commands', async () => {
    const existingBot = {
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Old Name',
      username: 'old_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot;
    botsRepository.findOwnedBot.mockResolvedValue(existingBot);
    botsRepository.exist.mockResolvedValue(false);
    botsRepository.save.mockResolvedValue(existingBot);

    const updated = await service.updateBot('owner-1', 'bot-1', {
      name: 'New Name',
      commands: [{ command: '/status', description: 'Status', usage: '/status' }],
    });

    expect(updated.name).toBe('New Name');
    expect(botCommandsRepository.replaceForBot).toHaveBeenCalledWith('bot-1', [
      { command: '/status', description: 'Status', usage: '/status' },
    ]);
  });

  it('deletes an owned bot', async () => {
    const ownedBot = {
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Delete Me',
      username: 'delete_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot;
    botsRepository.findOwnedBot.mockResolvedValue(ownedBot);

    await service.deleteBot('owner-1', 'bot-1');
    expect(botsRepository.remove).toHaveBeenCalledWith(ownedBot);
  });

  it('removes a bot from group membership', async () => {
    botsRepository.findOwnedBot.mockResolvedValue({
      id: 'bot-1',
      ownerId: 'owner-1',
      name: 'Delete Membership',
      username: 'member_bot',
      avatarUrl: null,
      webhookUrl: 'https://example.com',
      webhookSecret: 'secret',
      scopes: ['messages:read'],
      isActive: true,
      createdAt: new Date(),
      commands: [],
      groupMemberships: [],
    } as unknown as Bot);

    await service.removeFromGroup('owner-1', 'group-1', 'bot-1');
    expect(botGroupMembersRepository.delete).toHaveBeenCalledWith({ groupId: 'group-1', botId: 'bot-1' });
  });

  it('returns null for non-command text', async () => {
    const result = await service.processCommand('group-1', 'hello everyone');
    expect(result).toBeNull();
  });

  it('returns active bots by group with isBot flag', async () => {
    botGroupMembersRepository.find.mockResolvedValue([
      {
        groupId: 'group-1',
        bot: {
          id: 'bot-1',
          name: 'Active Bot',
          username: 'active_bot',
          avatarUrl: null,
          isActive: true,
        },
      },
      {
        groupId: 'group-1',
        bot: {
          id: 'bot-2',
          name: 'Inactive Bot',
          username: 'inactive_bot',
          avatarUrl: null,
          isActive: false,
        },
      },
    ] as unknown as BotGroupMember[]);

    const participants = await service.getBotsByGroup('group-1');
    expect(participants).toEqual([
      {
        groupId: 'group-1',
        botId: 'bot-1',
        name: 'Active Bot',
        username: 'active_bot',
        avatarUrl: null,
        isBot: true,
      },
    ]);
  });
});
