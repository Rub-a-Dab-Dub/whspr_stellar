import { ApiProperty } from '@nestjs/swagger';

export class Sep10ChallengeResponseDto {
  @ApiProperty({ description: 'Base64-encoded SEP-10 challenge transaction XDR' })
  transaction!: string;

  @ApiProperty({ description: 'Stellar network passphrase' })
  network_passphrase!: string;
}
