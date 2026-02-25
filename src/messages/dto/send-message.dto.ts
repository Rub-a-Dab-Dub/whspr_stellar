import { IsNotEmpty, IsNumber, IsString, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  roomId: number;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'contentHash must be 64 hex characters (32 bytes)',
  })
  contentHash: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  tipAmount: number = 0;
}
