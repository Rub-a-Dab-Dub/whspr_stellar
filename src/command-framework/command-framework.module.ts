import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandFrameworkController } from './command-framework.controller';
import { CommandFrameworkService } from './command-framework.service';
import { BotCommand } from './entities/bot-command.entity';
import { CommandFrameworkRepository } from './command-framework.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([BotCommand]),
  ],
  controllers: [CommandFrameworkController],
  providers: [CommandFrameworkService, CommandFrameworkRepository],
  exports: [CommandFrameworkService],
})
export class CommandFrameworkModule {}

