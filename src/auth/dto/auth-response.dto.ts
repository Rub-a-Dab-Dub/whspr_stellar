import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserResponseDto } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  @ApiPropertyOptional({
    description: 'JWT access token (omitted when requiresTwoFactor is true)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken?: string;

  @ApiPropertyOptional({
    description: 'JWT refresh token (omitted when requiresTwoFactor is true)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken?: string;

  @ApiPropertyOptional({ description: 'True when wallet signature was valid but TOTP is required next' })
  requiresTwoFactor?: boolean;

  @ApiPropertyOptional({
    description: 'Short-lived JWT for POST /2fa/verify when requiresTwoFactor is true',
  })
  pendingToken?: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user!: UserResponseDto;

  @ApiProperty({
    description: 'Token type',
    example: 'Bearer',
  })
  tokenType!: string;

  @ApiProperty({
    description: 'Access or pending-token expiration in seconds',
    example: 900,
  })
  expiresIn!: number;
}
