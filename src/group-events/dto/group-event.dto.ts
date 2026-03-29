import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EventStatus, EventType } from '../entities/group-event.entity';
import { RSVPStatus } from '../entities/event-rsvp.entity';

export class CreateGroupEventDto {
  @ApiProperty({ example: 'Weekly Standup' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: EventType })
  @IsEnum(EventType)
  eventType!: EventType;

  @ApiPropertyOptional({ example: 'Lagos, Nigeria' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({ example: 'https://meet.google.com/abc-xyz' })
  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @ApiProperty({ example: '2026-06-01T10:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-06-01T11:00:00.000Z' })
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxAttendees?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateGroupEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  meetingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxAttendees?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class RsvpDto {
  @ApiProperty({ enum: RSVPStatus, example: RSVPStatus.GOING })
  @IsEnum(RSVPStatus)
  status!: RSVPStatus;
}

export class GroupEventResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupId!: string;
  @ApiProperty() createdBy!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty({ enum: EventType }) eventType!: EventType;
  @ApiPropertyOptional() location!: string | null;
  @ApiPropertyOptional() meetingUrl!: string | null;
  @ApiProperty() startTime!: Date;
  @ApiProperty() endTime!: Date;
  @ApiPropertyOptional() maxAttendees!: number | null;
  @ApiProperty() isPublic!: boolean;
  @ApiProperty({ enum: EventStatus }) status!: EventStatus;
  @ApiProperty() goingCount!: number;
  @ApiProperty() maybeCount!: number;
  @ApiProperty() waitlistedCount!: number;
  @ApiProperty() createdAt!: Date;
}

export class EventRsvpResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: RSVPStatus }) status!: RSVPStatus;
  @ApiProperty() respondedAt!: Date;
}

export class AttendeeResponseDto {
  @ApiProperty() userId!: string;
  @ApiProperty({ enum: RSVPStatus }) status!: RSVPStatus;
  @ApiProperty() respondedAt!: Date;
}
