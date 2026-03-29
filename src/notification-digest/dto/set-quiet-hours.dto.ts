import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { InAppNotificationType } from '../../notifications/entities/notification.entity';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const EXEMPT_NOTIFICATION_TYPES = [
  InAppNotificationType.TRANSFER_RECEIVED,
  'SECURITY_ALERT',
] as const;

export class SetQuietHoursDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isEnabled!: boolean;

  @ApiProperty({ example: '22:00', description: '24-hour HH:MM format' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @ApiProperty({ example: '08:00', description: '24-hour HH:MM format' })
  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime must be in HH:MM format' })
  endTime!: string;

  @ApiProperty({ example: 'America/New_York', description: 'IANA timezone' })
  @IsString()
  timezone!: string;

  @ApiProperty({
    example: ['TRANSFER_RECEIVED', 'SECURITY_ALERT'],
    description: 'Notification types exempt from quiet hours',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(EXEMPT_NOTIFICATION_TYPES, { each: true })
  exemptTypes?: string[];
}
