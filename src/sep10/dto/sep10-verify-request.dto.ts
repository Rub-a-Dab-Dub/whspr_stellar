import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class Sep10VerifyRequestDto {
  @ApiProperty({ description: 'Base64-encoded signed transaction XDR' })
  @IsString()
  @IsNotEmpty()
  transaction!: string;

  @ApiProperty({ description: 'Stellar account address (G...)' })
  @IsString()
  @IsNotEmpty()
  account!: string;
}
