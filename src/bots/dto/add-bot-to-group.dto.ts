import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddBotToGroupDto {
  @ApiProperty()
  @IsUUID()
  botId!: string;
}
