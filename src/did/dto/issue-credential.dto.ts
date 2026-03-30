import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CredentialProofDto {
  @ApiProperty({ example: 'Ed25519Signature2020' })
  @IsString()
  type!: string;

  @ApiProperty({ description: 'Base64-encoded signature' })
  @IsString()
  proofValue!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verificationMethod?: string;
}

export class IssueCredentialDto {
  @ApiProperty()
  @IsUUID()
  didId!: string;

  @ApiProperty()
  @IsString()
  credentialType!: string;

  @ApiProperty({ description: 'Issuer DID string' })
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

  @ApiPropertyOptional({ description: 'Show on public profile when user consents' })
  @IsOptional()
  @IsBoolean()
  showOnProfile?: boolean;

  @ApiPropertyOptional({
    description: 'If true, verify cryptographic proof before persisting',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  verifyProof?: boolean;
}
