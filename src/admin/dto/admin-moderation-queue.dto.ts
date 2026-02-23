import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsInt,
  IsNumber,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ModerationStatus,
  PriorityLevel,
  ContentType,
  ModerationAction,
  AppealStatus,
} from '../../moderation/moderation-queue.entity';

// ─── Queue Filter ────────────────────────────────────────────────────────────

export class ModerationQueueFilterDto {
  @ApiPropertyOptional({ enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @ApiPropertyOptional({ enum: PriorityLevel })
  @IsOptional()
  @IsEnum(PriorityLevel)
  priority?: PriorityLevel;

  @ApiPropertyOptional({ enum: ContentType })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;

  @ApiPropertyOptional({ description: 'UUID of assigned moderator' })
  @IsOptional()
  @IsUUID()
  assignedModeratorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAutoFlagged?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 'createdAt', enum: ['createdAt', 'priority', 'reportCount'] })
  @IsOptional()
  @IsIn(['createdAt', 'priority', 'reportCount'])
  sortBy?: 'createdAt' | 'priority' | 'reportCount' = 'createdAt';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

// ─── Assign Moderator ────────────────────────────────────────────────────────

export class AssignModeratorDto {
  @ApiProperty({ description: 'UUID of the moderator to assign' })
  @IsNotEmpty()
  @IsUUID()
  moderatorId: string;
}

// ─── Moderation Action ────────────────────────────────────────────────────────

export class ActionMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  banDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  warningLevel?: number;

  @ApiPropertyOptional({ description: 'UUID of moderation template to use' })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customMessage?: string;
}

export class ModerationActionDto {
  @ApiProperty({ enum: ModerationAction })
  @IsNotEmpty()
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({ type: () => ActionMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionMetadataDto)
  actionMetadata?: ActionMetadataDto;

  @ApiPropertyOptional({ description: 'UUID of senior moderator to escalate to' })
  @IsOptional()
  @IsUUID()
  escalateToModeratorId?: string;
}

// ─── Batch Moderation ────────────────────────────────────────────────────────

export class BatchModerationActionDto {
  @ApiProperty({ type: [String], description: 'Array of queue item UUIDs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  queueItemIds: string[];

  @ApiProperty({ enum: ModerationAction })
  @IsNotEmpty()
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'UUID of template to use for this batch' })
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

// ─── Appeal ──────────────────────────────────────────────────────────────────

export class SubmitAppealDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appealReason: string;

  @ApiPropertyOptional()
  @IsOptional()
  evidence?: {
    text?: string;
    urls?: string[];
    attachments?: string[];
  };
}

export class ReviewAppealDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

// ─── Escalate ─────────────────────────────────────────────────────────────────

export class EscalateDto {
  @ApiProperty({ description: 'UUID of senior moderator to escalate to' })
  @IsNotEmpty()
  @IsUUID()
  escalateToModeratorId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

// ─── Template ─────────────────────────────────────────────────────────────────

export class CreateModerationTemplateDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ModerationAction })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  messageTemplate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotesTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  defaultSettings?: {
    banDuration?: number;
    warningLevel?: number;
  };
}

// ─── Appeal Filter ────────────────────────────────────────────────────────────

export class AppealFilterDto {
  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// ─── Metrics Filter ───────────────────────────────────────────────────────────

export class ModeratorMetricsFilterDto {
  @ApiPropertyOptional({ description: 'Filter by specific moderator UUID' })
  @IsOptional()
  @IsUUID()
  moderatorId?: string;

  @ApiPropertyOptional({ description: 'ISO date string – from date' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string – to date' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

// ─── Analytics Filter ─────────────────────────────────────────────────────────

export class ModerationAnalyticsFilterDto {
  @ApiPropertyOptional({ description: 'ISO date string – from date' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string – to date' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}
