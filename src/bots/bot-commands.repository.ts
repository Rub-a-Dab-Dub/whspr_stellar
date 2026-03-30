import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { BotCommand } from './entities/bot-command.entity';

export interface BotCommandInput {
  command: string;
  description: string;
  usage: string;
}

@Injectable()
export class BotCommandsRepository extends Repository<BotCommand> {
  constructor(private readonly dataSource: DataSource) {
    super(BotCommand, dataSource.createEntityManager());
  }

  async replaceForBot(botId: string, commands: BotCommandInput[]): Promise<BotCommand[]> {
    await this.delete({ botId });
    if (commands.length === 0) {
      return [];
    }

    const entities = commands.map((command) =>
      this.create({
        botId,
        command: command.command,
        description: command.description,
        usage: command.usage,
      }),
    );
    return this.save(entities);
  }
}
