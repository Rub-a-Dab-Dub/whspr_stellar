import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── POST /auth/nonce ─────────────────────────────────────────────────────────

export class NonceRequestDto {
  @ApiProperty({ example: '0x1234567890abcdef1234567890abcdef12345678', description: 'EVM wallet address (42 chars)' })
  @IsString()
  @IsNotEmpty()
  @Length(42, 42, {
    message: 'walletAddress must be a 42-character EVM address',
  })
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: 'walletAddress must be a valid EVM hex address starting with 0x',
  })
  walletAddress: string;
}

// ─── POST /auth/verify ───────────────────────────────────────────────────────

export class VerifySignatureDto {
  @ApiProperty({ example: '0x1234567890abcdef1234567890abcdef12345678' })
  @IsString()
  @IsNotEmpty()
  @Length(42, 42)
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  walletAddress: string;

  @ApiProperty({ example: '0xdeadbeef...', description: 'EIP-191 signed nonce message' })
  @IsString()
  @IsNotEmpty()
  signature: string;
}

// ─── POST /auth/refresh ──────────────────────────────────────────────────────

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGci...', description: 'Refresh token from login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

// ─── POST /auth/logout ───────────────────────────────────────────────────────

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke' })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
