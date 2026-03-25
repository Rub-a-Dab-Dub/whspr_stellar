import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';

export class ChallengeRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address (public key)',
    example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  })
  @IsString()
  @Length(56, 56, { message: 'Stellar address must be exactly 56 characters' })
  @Matches(/^G[A-Z2-7]{55}$/, { message: 'Invalid Stellar address format' })
  walletAddress!: string;
}
