import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class VerifyRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address (public key)',
    example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  })
  @IsString()
  @Length(56, 56)
  @Matches(/^G[A-Z2-7]{55}$/)
  walletAddress!: string;

  @ApiProperty({
    description: 'Signature of the challenge message (base64 encoded)',
    example: 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBzaWduYXR1cmUgZXhhbXBsZQ==',
  })
  @IsString()
  signature!: string;
}
