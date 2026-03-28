import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, Length } from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class ChallengeRequestDto {
  @ApiProperty({
    description: 'Stellar wallet address (public key)',
    example: 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM',
  })
  @IsString({ message: validationMessages.string() })
  @Length(56, 56, { message: validationMessages.exactLength(56) })
  @Matches(/^G[A-Z2-7]{55}$/, { message: validationMessages.stellarAddressFormat() })
  walletAddress!: string;
}
