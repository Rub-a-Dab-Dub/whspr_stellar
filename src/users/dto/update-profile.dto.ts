import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class UpdateProfileDto {
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
    example: 'sw',
    maxLength: 10,
  })
  @IsOptional()
  @IsString({ message: validationMessages.string() })
  @MaxLength(10, { message: validationMessages.maxLength(10) })
  preferredLocale?: string | null;
}
