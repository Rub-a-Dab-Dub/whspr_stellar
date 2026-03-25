import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { KeyType } from '../entities/encryption-key.entity';

export class PreKeyDto {
  @ApiProperty({ example: 1, description: 'Unique prekey identifier' })
  @IsInt()
  @Min(1)
  keyId!: number;

  @ApiProperty({ example: 'base64encodedpublickey==', description: 'Base64-encoded prekey public key' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}

export class RegisterKeyDto {
  @ApiProperty({ example: 'base64encodedpublickey==', description: 'Base64-encoded public key (X25519 or Ed25519)' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({ enum: KeyType, example: KeyType.X25519, description: 'Key algorithm type' })
  @IsEnum(KeyType)
  keyType!: KeyType;

  @ApiPropertyOptional({
    type: [PreKeyDto],
    description: 'Prekey bundle for offline key exchange (Signal Protocol)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreKeyDto)
  preKeys?: PreKeyDto[];
}
