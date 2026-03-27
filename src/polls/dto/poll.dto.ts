import {
  IsUUID,
  IsString,
  IsArray,
  IsBoolean,
  IsDate,
  IsOptional,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePollDto {
  @ApiProperty({ description: 'Poll question', minLength: 3, maxLength: 255 })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  question!: string;

  @ApiProperty({
    description: 'Array of poll options (2-10)',
    type: [String],
    minItems: 2,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(2, { message: 'Poll must have at least 2 options' })
  @ArrayMaxSize(10, { message: 'Poll can have maximum 10 options' })
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options!: string[];

  @ApiPropertyOptional({
    description: 'Allow voters to select multiple options',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean = false;

  @ApiPropertyOptional({
    description: 'Hide voter identity (show only vote counts)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean = false;

  @ApiPropertyOptional({
    description: 'Poll expiration time (ISO string)',
    format: 'date-time',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

export class CastVoteDto {
  @ApiProperty({
    description: 'Array of selected option indices (0-based)',
    type: [Number],
    example: [0, 2],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one option must be selected' })
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  optionIndexes!: number[];
}

export class PollOptionResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  text!: string;

  @ApiPropertyOptional()
  voteCount?: number;
}

export class PollResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ format: 'uuid' })
  createdBy!: string;

  @ApiProperty()
  question!: string;

  @ApiProperty({ type: [PollOptionResponseDto] })
  options!: PollOptionResponseDto[];

  @ApiProperty()
  allowMultiple!: boolean;

  @ApiProperty()
  isAnonymous!: boolean;

  @ApiProperty({ nullable: true })
  expiresAt!: Date | null;

  @ApiProperty()
  isClosed!: boolean;

  @ApiProperty()
  totalVotes!: number;

  @ApiProperty()
  userVoted?: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PollListResponseDto {
  @ApiProperty({ type: [PollResultResponseDto] })
  data!: PollResultResponseDto[];

  @ApiProperty()
  total!: number;
}
