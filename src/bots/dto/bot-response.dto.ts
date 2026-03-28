import { ApiProperty } from '@nestjs/swagger';
import { BotCommandResponseDto } from './bot-command-response.dto';

export class BotResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty()
  webhookUrl!: string;

  @ApiProperty({ type: [String] })
  scopes!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [BotCommandResponseDto] })
  commands!: BotCommandResponseDto[];
}
