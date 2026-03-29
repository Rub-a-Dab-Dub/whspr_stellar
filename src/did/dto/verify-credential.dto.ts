import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CredentialProofDto } from './issue-credential.dto';

export class InlineCredentialDto {
  @ApiProperty()
  @IsString()
  credentialType!: string;

  @ApiProperty()
  @IsString()
  issuer!: string;

  @ApiProperty()
  @IsObject()
  credentialSubject!: Record<string, unknown>;

  @ApiProperty()
  @ValidateNested()
  @Type(() => CredentialProofDto)
  proof!: CredentialProofDto;

  @ApiProperty()
  @IsDateString()
  issuedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class VerifyCredentialDto {
  @ApiPropertyOptional({ description: 'Verify stored credential by id instead of inline payload' })
  @IsOptional()
  @IsUUID()
  credentialId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineCredentialDto)
  credential?: InlineCredentialDto;
}
