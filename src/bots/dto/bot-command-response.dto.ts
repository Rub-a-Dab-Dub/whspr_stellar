import { ApiProperty } from '@nestjs/swagger';

export class BotCommandResponseDto {
  @ApiProperty()
  command!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  usage!: string;
}
