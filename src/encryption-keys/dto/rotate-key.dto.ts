import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { KeyType } from '../entities/encryption-key.entity';
import { PreKeyDto } from './register-key.dto';

export class RotateKeyDto {
  @ApiProperty({ example: 'base64encodednewpublickey==', description: 'Base64-encoded new public key' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({ enum: KeyType, example: KeyType.X25519, description: 'Key algorithm type' })
  @IsEnum(KeyType)
  keyType!: KeyType;

  @ApiPropertyOptional({
    type: [PreKeyDto],
    description: 'New prekey bundle to replace the existing one',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreKeyDto)
  preKeys?: PreKeyDto[];
}
