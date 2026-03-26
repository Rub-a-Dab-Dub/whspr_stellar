import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../../messages/entities/message.entity';

export class PinnedMessageSnapshotDto {
  @ApiProperty()
  content!: string;

  @ApiProperty({ enum: MessageType })
  type!: MessageType;

  @ApiPropertyOptional({ format: 'uuid' })
  senderId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PinnedMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty({ format: 'uuid' })
  messageId!: string;

  @ApiProperty({ format: 'uuid' })
  pinnedBy!: string;

  @ApiProperty()
  pinnedAt!: Date;

  @ApiPropertyOptional()
  note!: string | null;

  @ApiProperty()
  displayOrder!: number;

  @ApiProperty({ type: PinnedMessageSnapshotDto })
  snapshot!: PinnedMessageSnapshotDto;
}
