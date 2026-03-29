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
  Length,
} from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class CreateUserDto {
  @ApiProperty({
    description: 'Ethereum wallet address',
    example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  })
  @IsEthereumAddress({ message: validationMessages.ethereumAddress() })
  walletAddress!: string;

  @ApiPropertyOptional({
    description: 'Unique username (3-50 characters, alphanumeric and underscores)',
    example: 'john_doe',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MinLength(3, { message: validationMessages.minLength(3) })
  @MaxLength(50, { message: validationMessages.maxLength(50) })
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: validationMessages.usernamePattern(),
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: validationMessages.email() })
  @MaxLength(255, { message: validationMessages.maxLength(255) })
  email?: string;

  @ApiPropertyOptional({
    description: 'Display name',
    example: 'John Doe',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MaxLength(100, { message: validationMessages.maxLength(100) })
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: validationMessages.url() })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: 'User bio',
    example: 'Crypto enthusiast and developer',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MaxLength(500, { message: validationMessages.maxLength(500) })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Preferred locale, for example en, fr, pt, or sw',
    example: 'fr',
    maxLength: 10,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MaxLength(10, { message: validationMessages.maxLength(10) })
  preferredLocale?: string;

  @ApiPropertyOptional({
    description: 'Platform invite code (required when invite-only mode is enabled)',
    example: 'AbCdEfGhIjKlMnOp',
    minLength: 16,
    maxLength: 16,
  })
  @IsOptional()
  @IsString()
  @Length(16, 16)
  @Matches(/^[A-Za-z0-9_-]{16}$/)
  inviteCode?: string;
}
