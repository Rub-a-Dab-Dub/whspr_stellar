import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import type { DidMethod } from '../entities/did-record.entity';

export class RegisterDidDto {
  @ApiProperty({ enum: ['stellar', 'key', 'web'] })
  @IsEnum(['stellar', 'key', 'web'] as const)
  method!: DidMethod;

  @ApiPropertyOptional({
    description: 'Stellar account id (G...) when method is stellar',
  })
  @ValidateIf((o) => o.method === 'stellar')
  @IsString()
  stellarPublicKey?: string;

  @ApiPropertyOptional({ description: 'Network segment for did:stellar (default testnet)' })
  @IsOptional()
  @IsString()
  stellarNetwork?: string;

  @ApiPropertyOptional({ description: 'Optional W3C DID document overrides (merged with generated base)' })
  @IsOptional()
  @IsObject()
  didDocument?: Record<string, unknown>;
}
