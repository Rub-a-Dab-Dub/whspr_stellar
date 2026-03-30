import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentType } from '../entities/legal-document.entity';

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

  @ApiProperty({ example: '2026-03-30T00:00:00.000Z' })
  @IsDateString()
  effectiveDate!: string;
}

export class LegalDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: LegalDocumentType })
  type!: LegalDocumentType;

  @ApiProperty()
  version!: string;

  @ApiProperty()
  effectiveDate!: Date;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}
