import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
  IsEthereumAddress,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiPropertyOptional({
    description: 'Unique username (3-50 characters, alphanumeric and underscores)',
    example: 'john_doe',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Display name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Crypto enthusiast and developer',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
