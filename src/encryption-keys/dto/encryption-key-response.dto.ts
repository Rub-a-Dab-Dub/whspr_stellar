import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { KeyType } from '../entities/encryption-key.entity';

@Exclude()
export class EncryptionKeyResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId!: string;

  @Expose()
  @ApiProperty({ example: 'base64encodedpublickey==' })
  publicKey!: string;

  @Expose()
  @ApiProperty({ enum: KeyType, example: KeyType.X25519 })
  keyType!: KeyType;

  @Expose()
  @ApiProperty({ example: 1 })
  version!: number;

  @Expose()
  @ApiProperty({ example: true })
  isActive!: boolean;

  @Expose()
  @ApiProperty({ example: false })
  registeredOnChain!: boolean;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date;

  constructor(partial: Partial<EncryptionKeyResponseDto>) {
    Object.assign(this, partial);
  }
}
