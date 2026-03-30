import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Bot } from './entities/bot.entity';

@Injectable()
export class BotsRepository extends Repository<Bot> {
  constructor(private readonly dataSource: DataSource) {
    super(Bot, dataSource.createEntityManager());
  }

  async findByOwner(ownerId: string): Promise<Bot[]> {
    return this.find({
      where: { ownerId },
      relations: ['commands'],
      order: { createdAt: 'DESC', commands: { command: 'ASC' } },
    });
  }

  async findOwnedBot(ownerId: string, botId: string): Promise<Bot | null> {
    return this.findOne({
      where: { id: botId, ownerId },
      relations: ['commands'],
    });
  }
}
