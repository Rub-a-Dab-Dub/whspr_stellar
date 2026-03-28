import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Job, Queue, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { BotsRepository } from './bots.repository';
import { BotCommandsRepository } from './bot-commands.repository';
import { Bot } from './entities/bot.entity';
import { BotGroupMember } from './entities/bot-group-member.entity';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';
import { BotResponseDto } from './dto/bot-response.dto';
import { GroupBotParticipantDto } from './dto/group-bot-participant.dto';

interface BotDispatchJobData {
  groupId: string;
  botId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

const BOT_DISPATCH_QUEUE = 'bot-webhook-dispatch';
const RESPONSE_SIGNATURE_HEADER = 'x-whspr-signature';
const REQUEST_SIGNATURE_HEADER = 'x-whspr-signature';
const REQUEST_EVENT_HEADER = 'x-whspr-event';
const REQUEST_TIMEOUT_MS = 2000;

@Injectable()
export class BotsService implements OnModuleDestroy {
  private readonly logger = new Logger(BotsService.name);
  private readonly queue: Queue<BotDispatchJobData> | null = null;
  private readonly worker: Worker<BotDispatchJobData> | null = null;

  constructor(
    private readonly botsRepository: BotsRepository,
    private readonly botCommandsRepository: BotCommandsRepository,
    @InjectRepository(BotGroupMember)
    private readonly botGroupMembersRepository: Repository<BotGroupMember>,
    configService: ConfigService,
  ) {
    const queueEnabled = configService.get<boolean>('BOTS_QUEUE_ENABLED', true);
    if (!queueEnabled) {
      return;
    }

    const connection = {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: configService.get<number>('REDIS_DB', 0),
      maxRetriesPerRequest: null as number | null,
    };

    this.queue = new Queue<BotDispatchJobData>(BOT_DISPATCH_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 250 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });

    this.worker = new Worker<BotDispatchJobData>(
      BOT_DISPATCH_QUEUE,
      async (job) => this.processDispatchJob(job),
      { connection },
    );
  }

  async createBot(ownerId: string, dto: CreateBotDto): Promise<BotResponseDto> {
    const usernameInUse = await this.botsRepository.exist({ where: { username: dto.username } });
    if (usernameInUse) {
      throw new BadRequestException('Bot username is already in use');
    }

    const bot = this.botsRepository.create({
      ownerId,
      name: dto.name,
      username: dto.username,
      avatarUrl: dto.avatarUrl ?? null,
      webhookUrl: dto.webhookUrl,
      webhookSecret: dto.webhookSecret,
      scopes: dto.scopes,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.botsRepository.save(bot);

    if (dto.commands) {
      await this.botCommandsRepository.replaceForBot(saved.id, dto.commands);
    }
    const hydrated = await this.getOwnedBotOrThrow(ownerId, saved.id);
    return this.toBotResponse(hydrated);
  }

  async getBots(ownerId: string): Promise<BotResponseDto[]> {
    const bots = await this.botsRepository.findByOwner(ownerId);
    return bots.map((bot) => this.toBotResponse(bot));
  }

  async updateBot(ownerId: string, botId: string, dto: UpdateBotDto): Promise<BotResponseDto> {
    const bot = await this.getOwnedBotOrThrow(ownerId, botId);

    if (dto.username && dto.username !== bot.username) {
      const usernameInUse = await this.botsRepository.exist({ where: { username: dto.username } });
      if (usernameInUse) {
        throw new BadRequestException('Bot username is already in use');
      }
    }

    Object.assign(bot, {
      name: dto.name ?? bot.name,
      username: dto.username ?? bot.username,
      avatarUrl: dto.avatarUrl ?? bot.avatarUrl,
      webhookUrl: dto.webhookUrl ?? bot.webhookUrl,
      webhookSecret: dto.webhookSecret ?? bot.webhookSecret,
      scopes: dto.scopes ?? bot.scopes,
      isActive: dto.isActive ?? bot.isActive,
    });

    await this.botsRepository.save(bot);

    if (dto.commands) {
      await this.botCommandsRepository.replaceForBot(bot.id, dto.commands);
    }

    const hydrated = await this.getOwnedBotOrThrow(ownerId, bot.id);
    return this.toBotResponse(hydrated);
  }

  async deleteBot(ownerId: string, botId: string): Promise<void> {
    const bot = await this.getOwnedBotOrThrow(ownerId, botId);
    await this.botsRepository.remove(bot);
  }

  async addToGroup(ownerId: string, groupId: string, botId: string): Promise<GroupBotParticipantDto> {
    const bot = await this.getOwnedBotOrThrow(ownerId, botId);

    const existing = await this.botGroupMembersRepository.findOne({ where: { groupId, botId } });
    if (!existing) {
      await this.botGroupMembersRepository.save(
        this.botGroupMembersRepository.create({
          groupId,
          botId,
          isBot: true,
        }),
      );
    }

    return this.toGroupBotParticipant(groupId, bot);
  }

  async removeFromGroup(ownerId: string, groupId: string, botId: string): Promise<void> {
    await this.getOwnedBotOrThrow(ownerId, botId);
    await this.botGroupMembersRepository.delete({ groupId, botId });
  }

  async dispatchEvent(
    groupId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const members = await this.botGroupMembersRepository.find({
      where: { groupId },
      relations: ['bot'],
    });
    const activeMembers = members.filter((member) => member.bot?.isActive);

    if (this.queue) {
      await Promise.all(
        activeMembers.map((member) =>
          this.queue!.add('dispatch-group-event', {
            groupId,
            botId: member.botId,
            eventType,
            payload,
          }),
        ),
      );
      return;
    }

    await Promise.all(
      activeMembers.map((member) => this.dispatchToBot(member.bot, groupId, eventType, payload)),
    );
  }

  async processCommand(groupId: string, commandInput: string): Promise<string | null> {
    const normalized = commandInput.trim();
    if (!normalized.startsWith('/')) {
      return null;
    }

    const [command] = normalized.split(/\s+/u);
    if (command.toLowerCase() === '/help') {
      return this.buildHelpMessage(groupId);
    }

    await this.dispatchEvent(groupId, 'group.command', {
      command,
      raw: normalized,
    });
    return null;
  }

  async getBotsByGroup(groupId: string): Promise<GroupBotParticipantDto[]> {
    const members = await this.botGroupMembersRepository.find({
      where: { groupId },
      relations: ['bot'],
      order: { createdAt: 'ASC' },
    });
    return members
      .filter((member) => member.bot?.isActive)
      .map((member) => this.toGroupBotParticipant(groupId, member.bot));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }

  private async processDispatchJob(job: Job<BotDispatchJobData>): Promise<void> {
    const { groupId, botId, eventType, payload } = job.data;
    const member = await this.botGroupMembersRepository.findOne({
      where: { groupId, botId },
      relations: ['bot'],
    });
    if (!member?.bot || !member.bot.isActive) {
      return;
    }

    await this.dispatchToBot(member.bot, groupId, eventType, payload);
  }

  private async dispatchToBot(
    bot: Bot,
    groupId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({
      eventType,
      groupId,
      payload,
      dispatchedAt: new Date().toISOString(),
    });
    const signature = this.signPayload(body, bot.webhookSecret);
    const timeoutController = new AbortController();
    const timeoutHandle = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(bot.webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [REQUEST_EVENT_HEADER]: eventType,
          [REQUEST_SIGNATURE_HEADER]: signature,
        },
        body,
        signal: timeoutController.signal,
      });

      const responseBody = await response.text();
      if (!response.ok) {
        throw new BadRequestException(`Bot webhook failed with status ${response.status}`);
      }

      if (responseBody.length > 0) {
        const responseSignature = response.headers.get(RESPONSE_SIGNATURE_HEADER);
        if (!responseSignature) {
          throw new BadRequestException('Bot response signature is missing');
        }

        const valid = this.verifySignature(responseBody, bot.webhookSecret, responseSignature);
        if (!valid) {
          throw new BadRequestException('Bot response signature is invalid');
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to dispatch "${eventType}" to bot=${bot.id} group=${groupId}: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private async buildHelpMessage(groupId: string): Promise<string> {
    const members = await this.botGroupMembersRepository.find({
      where: { groupId },
      relations: ['bot', 'bot.commands'],
    });
    const commandLines = members
      .filter((member) => member.bot?.isActive)
      .flatMap((member) =>
        member.bot.commands.map(
          (command) => `${command.command} - ${command.description} (usage: ${command.usage})`,
        ),
      )
      .sort((left, right) => left.localeCompare(right));

    if (commandLines.length === 0) {
      return 'No bot commands are available in this group.';
    }

    return ['Available bot commands:', ...commandLines].join('\n');
  }

  private signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private verifySignature(payload: string, secret: string, signature: string): boolean {
    const expected = this.signPayload(payload, secret);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private async getOwnedBotOrThrow(ownerId: string, botId: string): Promise<Bot> {
    const bot = await this.botsRepository.findOwnedBot(ownerId, botId);
    if (!bot) {
      const existing = await this.botsRepository.findOne({ where: { id: botId } });
      if (existing) {
        throw new ForbiddenException('Bot does not belong to this user');
      }
      throw new NotFoundException('Bot not found');
    }
    return bot;
  }

  private toBotResponse(bot: Bot): BotResponseDto {
    return {
      id: bot.id,
      ownerId: bot.ownerId,
      name: bot.name,
      username: bot.username,
      avatarUrl: bot.avatarUrl,
      webhookUrl: bot.webhookUrl,
      scopes: bot.scopes,
      isActive: bot.isActive,
      createdAt: bot.createdAt,
      commands: (bot.commands ?? []).map((command) => ({
        command: command.command,
        description: command.description,
        usage: command.usage,
      })),
    };
  }

  private toGroupBotParticipant(groupId: string, bot: Bot): GroupBotParticipantDto {
    return {
      groupId,
      botId: bot.id,
      name: bot.name,
      username: bot.username,
      avatarUrl: bot.avatarUrl,
      isBot: true,
    };
  }
}
