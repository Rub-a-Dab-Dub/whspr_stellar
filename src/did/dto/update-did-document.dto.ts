import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateDidDocumentDto {
  @ApiPropertyOptional({
    description: 'DID string (required when using PATCH /did/document without path param)',
  })
  @IsOptional()
  @IsString()
  did?: string;

  @ApiProperty({ description: 'Full replacement DID document (must include id matching the DID)' })
  @IsObject()
  didDocument!: Record<string, unknown>;
}
