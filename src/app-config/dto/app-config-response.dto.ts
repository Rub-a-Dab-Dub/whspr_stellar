import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { AppConfigValueType } from '../constants';

export class AppConfigEntryDto {
  @ApiProperty()
  value!: unknown;

  @ApiProperty()
  valueType!: AppConfigValueType;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty()
  isPublic!: boolean;

  @ApiPropertyOptional()
  updatedBy!: string | null;

  @ApiProperty()
  updatedAt!: string;
}

export class AppConfigMapResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'object' } })
  entries!: Record<string, AppConfigEntryDto>;
}

export class PublicAppConfigResponseDto {
  @ApiProperty({
    description: 'Public, non-sensitive keys only',
    type: 'object',
    additionalProperties: true,
  })
  values!: Record<string, unknown>;
}
