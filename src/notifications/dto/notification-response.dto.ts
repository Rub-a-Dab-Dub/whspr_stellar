import { ApiProperty } from '@nestjs/swagger';
import { InAppNotificationType } from '../entities/notification.entity';

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: InAppNotificationType })
  type!: InAppNotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ required: false, type: Object, nullable: true })
  data!: Record<string, unknown> | null;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ required: false, nullable: true })
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] })
  items!: NotificationResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty()
  unreadCount!: number;
}
