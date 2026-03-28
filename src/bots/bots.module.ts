import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bot } from './entities/bot.entity';
import { BotCommand } from './entities/bot-command.entity';
import { BotGroupMember } from './entities/bot-group-member.entity';
import { BotsController } from './bots.controller';
import { BotsRepository } from './bots.repository';
import { BotCommandsRepository } from './bot-commands.repository';
import { BotsService } from './bots.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bot, BotCommand, BotGroupMember])],
  controllers: [BotsController],
  providers: [BotsService, BotsRepository, BotCommandsRepository],
  exports: [BotsService],
})
export class BotsModule {}
