import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  IsArray,
  IsEthereumAddress,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john_doe' })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Crypto enthusiast' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: ['Anonymous123', 'CryptoWhale'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pseudonyms?: string[];

  @ApiPropertyOptional({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @IsOptional()
  @IsEthereumAddress()
  walletAddress?: string;
}
