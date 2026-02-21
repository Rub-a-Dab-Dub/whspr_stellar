import { ApiProperty } from '@nestjs/swagger';

export class AdminAuthUserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;
}

export class AdminAuthResponseDto {
  @ApiProperty({ description: 'JWT access token for API authentication' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token for obtaining new access tokens' })
  refreshToken: string;

  @ApiProperty({ type: AdminAuthUserDto, description: 'Authenticated admin user info' })
  user: AdminAuthUserDto;
}
