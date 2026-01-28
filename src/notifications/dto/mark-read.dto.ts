import { IsArray, IsUUID, IsOptional } from 'class-validator';

export class MarkReadDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  notificationIds?: string[];
}

export class MarkAllReadDto {
  @IsOptional()
  @IsUUID()
  roomId?: string;
}