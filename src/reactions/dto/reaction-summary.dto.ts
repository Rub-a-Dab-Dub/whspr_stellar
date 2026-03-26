import { ApiProperty } from '@nestjs/swagger';

export class ReactionSummaryDto {
  @ApiProperty({ example: '🔥' })
  emoji!: string;

  @ApiProperty({ example: 12 })
  count!: number;

  @ApiProperty({
    type: [String],
    description: 'A small sample of user IDs who reacted with this emoji',
    example: ['user-a', 'user-b', 'user-c'],
  })
  sampleUsers!: string[];
}

export class MessageReactionsResponseDto {
  @ApiProperty({ type: [ReactionSummaryDto] })
  summary!: ReactionSummaryDto[];
}
