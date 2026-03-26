import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class TwoFactorCodeDto {
  @ApiProperty({ description: '6-digit TOTP or a single-use backup code', minLength: 6, maxLength: 32 })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}
