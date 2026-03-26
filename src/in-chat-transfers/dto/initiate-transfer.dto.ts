import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class InitiateTransferDto {
  @ApiProperty({ example: '/send @alice 10 XLM' })
  @IsString()
  @IsNotEmpty()
  rawCommand!: string;
}
