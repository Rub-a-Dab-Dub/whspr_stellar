import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MaxLength, MinLength } from 'class-validator';

export class TwoFactorVerifyLoginDto {
  @ApiProperty({ description: 'JWT from auth/verify when requiresTwoFactor is true' })
  @IsJWT()
  pendingToken!: string;

  @ApiProperty({ minLength: 6, maxLength: 32 })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code!: string;
}
