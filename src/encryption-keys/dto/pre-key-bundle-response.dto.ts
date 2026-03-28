import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class PreKeyResponseDto {
  @Expose()
  @ApiProperty({ example: 1 })
  keyId!: number;

  @Expose()
  @ApiProperty({ example: 'base64encodedprekeykey==' })
  publicKey!: string;
}

@Exclude()
export class PreKeyBundleResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  encryptionKeyId!: string;

  @Expose()
  @ApiProperty({ type: [PreKeyResponseDto] })
  @Type(() => PreKeyResponseDto)
  preKeys!: PreKeyResponseDto[];

  @Expose()
  @ApiProperty({ example: true })
  isValid!: boolean;

  @Expose()
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt!: Date;

  constructor(partial: Partial<PreKeyBundleResponseDto>) {
    Object.assign(this, partial);
  }
}
