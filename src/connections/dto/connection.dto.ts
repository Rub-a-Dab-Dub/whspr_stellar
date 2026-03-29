import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ConnectionRequestStatus } from '../entities/connection-request.entity';

export const CONNECTION_INTRO_MAX_LENGTH = 300;

export class SendConnectionRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  receiverId!: string;

  @ApiProperty({
    maxLength: CONNECTION_INTRO_MAX_LENGTH,
    description: 'Short professional intro (max 300 characters)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(CONNECTION_INTRO_MAX_LENGTH)
  introMessage!: string;
}

export class ConnectionRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  senderId!: string;

  @ApiProperty()
  receiverId!: string;

  @ApiProperty()
  introMessage!: string;

  @ApiProperty({ enum: ConnectionRequestStatus })
  status!: ConnectionRequestStatus;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional()
  respondedAt?: string | null;
}

export class ProfessionalConnectionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'The other user in this mutual connection' })
  peerUserId!: string;

  @ApiProperty()
  connectedAt!: string;

  @ApiProperty({ description: 'Number of mutual professional connections between you and this peer' })
  mutualCount!: number;
}

export enum ConnectionRequestDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  ALL = 'all',
}

export class ListConnectionRequestsQueryDto {
  @ApiPropertyOptional({ enum: ConnectionRequestDirection, default: ConnectionRequestDirection.INCOMING })
  @IsOptional()
  @IsEnum(ConnectionRequestDirection)
  direction?: ConnectionRequestDirection;
}

export enum ConnectionListSortField {
  MUTUAL_COUNT = 'mutualCount',
  CONNECTED_AT = 'connectedAt',
}

export class ListConnectionsQueryDto {
  @ApiPropertyOptional({ enum: ConnectionListSortField, default: ConnectionListSortField.CONNECTED_AT })
  @IsOptional()
  @IsEnum(ConnectionListSortField)
  sortBy?: ConnectionListSortField;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
