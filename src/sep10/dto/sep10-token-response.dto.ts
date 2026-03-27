import { ApiProperty } from '@nestjs/swagger';

export class Sep10TokenResponseDto {
  @ApiProperty({ description: 'JWT token with sub = Stellar account address' })
  token!: string;
}
