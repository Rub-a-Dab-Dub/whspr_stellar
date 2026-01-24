import {
  IsEnum,
  IsBoolean,
  IsInt,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';
import { MessagePermission } from '../entities/room-setting.entity';

export class UpdateRoomSettingsDto {
  @IsOptional()
  @IsEnum(MessagePermission)
  messagePermission?: MessagePermission;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  slowModeSeconds?: number;

  @IsOptional()
  @IsBoolean()
  allowLinks?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMedia?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  themeColor?: string;

  @IsOptional()
  @IsString()
  roomIcon?: string;

  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @IsOptional()
  @IsString()
  roomDescription?: string;
}
