import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LegalDocumentType, LegalDocumentStatus } from '../entities/legal-document.entity';

export class CreateLegalDocumentDto {
  @ApiProperty({ enum: LegalDocumentType })
  @IsEnum(LegalDocumentType)
  type!: LegalDocumentType;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  version!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;
}

export class LegalDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: LegalDocumentType })
  type!: LegalDocumentType;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  title!: string | null;

  @ApiPropertyOptional()
  summary!: string | null;

  @ApiProperty({ enum: LegalDocumentStatus })
  status!: LegalDocumentStatus;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
