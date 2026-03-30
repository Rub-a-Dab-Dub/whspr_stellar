import { IsUUID, IsArray, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForwardMessageDto {
  @ApiProperty({
    description: 'Array of target conversation IDs (max 5)',
    type: [String],
    format: 'uuid',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one target conversation is required' })
  @ArrayMaxSize(5, { message: 'Maximum 5 target conversations allowed' })
  @IsUUID('4', { each: true, message: 'Each target conversation ID must be a valid UUID' })
  targetConversationIds!: string[];
}

export class ForwardedMessageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  originalMessageId!: string;

  @ApiProperty({ format: 'uuid' })
  forwardedMessageId!: string;

  @ApiProperty({ format: 'uuid' })
  forwardedBy!: string;

  @ApiProperty({ format: 'uuid' })
  sourceConversationId!: string;

  @ApiProperty({ format: 'uuid' })
  targetConversationId!: string;

  @ApiProperty()
  forwardedAt!: Date;
}

export class MessageForwardChainItemDto {
  @ApiProperty({ format: 'uuid' })
  messageId!: string;

  @ApiProperty()
  originalTimestamp!: Date;

  @ApiProperty()
  originalSender!: string;

  @ApiProperty()
  forwardedBy!: string;

  @ApiProperty()
  forwardedAt!: Date;

  @ApiProperty()
  depth!: number;
}

export class MessageForwardChainResponseDto {
  @ApiProperty({ type: [MessageForwardChainItemDto] })
  chain!: MessageForwardChainItemDto[];

  @ApiProperty()
  totalDepth!: number;
}
