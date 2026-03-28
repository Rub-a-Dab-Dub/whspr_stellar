import { ApiProperty } from '@nestjs/swagger';

export class GroupBotParticipantDto {
  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  botId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({ default: true })
  isBot!: boolean;
}
