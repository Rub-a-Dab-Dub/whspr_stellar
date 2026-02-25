import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
  IsEnum,
  IsOptional,
  IsNumberString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionKeyScope } from '../entities/session-key.entity';

// ─── POST /auth/session-keys ──────────────────────────────────────────────────

export class CreateSessionKeyDto {
  @ApiProperty({
    description: 'Delegated signer public key (hex or Stellar address)',
    example: 'GBVVBBVMKPJ5KGDJZXZZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  publicKey: string;

  @ApiProperty({
    description: 'ISO 8601 expiry timestamp',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  expiresAt: string;

  @ApiProperty({
    description: 'Permitted operations',
    enum: SessionKeyScope,
    isArray: true,
    example: [SessionKeyScope.TIP],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(SessionKeyScope, { each: true })
  scope: SessionKeyScope[];

  @ApiPropertyOptional({
    description:
      'Max amount per single transaction (decimal string, e.g. "100.00")',
    example: '100.00',
  })
  @IsOptional()
  @IsNumberString()
  spendingLimitPerTx?: string;

  @ApiPropertyOptional({
    description: 'Cumulative spending cap over key lifetime (decimal string)',
    example: '1000.00',
  })
  @IsOptional()
  @IsNumberString()
  totalSpendingLimit?: string;

  @ApiPropertyOptional({
    description: 'Human-readable label for this key',
    example: 'Mobile dApp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

// ─── GET /auth/session-keys query ────────────────────────────────────────────

export class ListSessionKeysQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Include revoked keys' })
  @IsOptional()
  @Type(() => Boolean)
  includeRevoked?: boolean = false;
}
