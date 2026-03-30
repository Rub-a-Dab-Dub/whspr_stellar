import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  prefix!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ type: [String] })
  scopes!: string[];

  @ApiPropertyOptional({ nullable: true })
  lastUsedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  revokedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class CreatedApiKeyResponseDto extends ApiKeyResponseDto {
  @ApiProperty()
  key!: string;
}
