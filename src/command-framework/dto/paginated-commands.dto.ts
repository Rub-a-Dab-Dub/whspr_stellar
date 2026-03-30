import { ApiProperty } from '@nestjs/swagger';
import { BotCommand } from '../entities/bot-command.entity';

export class PaginatedCommandsDto {
  @ApiProperty({ type: [BotCommand] })
  commands: BotCommand[];

  @ApiProperty()
  total: number;

  constructor(commands: BotCommand[], total: number) {
    this.commands = commands;
    this.total = total;
  }
}

