import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FlagUserDto {
  @ApiProperty({ description: 'Reason for flagging the user', minLength: 10, maxLength: 280 })
  @IsString()
  @MinLength(10)
  @MaxLength(280)
  reason!: string;
}
