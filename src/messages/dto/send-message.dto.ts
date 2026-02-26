import { IsNotEmpty, IsNumber, IsString, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 1, description: 'Room ID to send message to' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  roomId: number;

  @ApiProperty({ example: 'a'.repeat(64), description: '32-byte content hash (64 hex chars)' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'contentHash must be 64 hex characters (32 bytes)',
  })
  contentHash: string;

  @ApiProperty({ example: 0, default: 0, description: 'Tip amount (0 for no tip)' })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  tipAmount: number = 0;
}
