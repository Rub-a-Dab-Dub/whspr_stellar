import { ApiProperty } from '@nestjs/swagger';

export class ChallengeResponseDto {
  @ApiProperty({
    description: 'Nonce to be signed by the wallet',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  nonce!: string;

  @ApiProperty({
    description: 'Challenge expiration timestamp',
    example: '2024-01-01T00:05:00.000Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Message to sign (includes nonce)',
    example:
      'Sign this message to authenticate: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  message!: string;
}
