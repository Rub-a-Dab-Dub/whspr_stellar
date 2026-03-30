import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptConsentDto {
  // document type comes from route param, userId from JWT
}

export class UserConsentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  version!: string;

  @ApiPropertyOptional()
  ipAddress!: string | null;

  @ApiPropertyOptional()
  userAgent!: string | null;

  @ApiProperty()
  acceptedAt!: Date;
}

export class ConsentStatusDto {
  @ApiProperty()
  hasAccepted!: boolean;

  @ApiPropertyOptional()
  acceptedAt?: Date;

  @ApiPropertyOptional()
  version?: string;
}
