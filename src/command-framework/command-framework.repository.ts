import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotCommand } from './entities/bot-command.entity';

@Injectable()
export class CommandFrameworkRepository {
  constructor(
    @InjectRepository(BotCommand)
    private repo: Repository<BotCommand>,
  ) {}

  async findEnabledByCommand(command: string): Promise<BotCommand | null> {
    return this.repo.findOne({
      where: { command, isEnabled: true },
    });
  }

  async findAvailable(conversationId: string, query?: string): Promise<BotCommand[]> {
    const qb = this.repo.createQueryBuilder('cmd')
      .where('cmd.isEnabled = :enabled', { enabled: true });

    if (query) {
      qb.andWhere('cmd.command ILIKE :query', { query: `%${query}%` });
    }

    // TODO: filter by conversation context/bots in group
    return qb.getMany();
  }

  async register(commandData: Partial<BotCommand>): Promise<BotCommand> {
    const command = this.repo.create(commandData);
    return this.repo.save(command);
  }

  async unregister(commandId: string): Promise<void> {
    await this.repo.softDelete(commandId);
  }

  async toggleEnabled(commandId: string, enabled: boolean): Promise<BotCommand> {
    const command = await this.repo.findOneOrFail({ where: { id: commandId } });
    command.isEnabled = enabled;
    return this.repo.save(command);
  }
}

