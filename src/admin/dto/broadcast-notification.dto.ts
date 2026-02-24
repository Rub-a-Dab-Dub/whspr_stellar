import {
  IsString,
  IsEnum,
  IsArray,
  IsObject,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsEnum(['announcement', 'maintenance', 'reward', 'custom'])
  type: 'announcement' | 'maintenance' | 'reward' | 'custom';

  @IsArray()
  @IsEnum(['in_app', 'email'], { each: true })
  channels: string[];

  @IsObject()
  targetAudience: {
    scope: 'all' | 'filtered';
    filters?: {
      minLevel?: number;
      status?: string;
      joinedBefore?: string;
      roomIds?: string[];
    };
  };

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
