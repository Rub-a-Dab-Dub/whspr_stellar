import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateReactionDto {
  @IsString()
  @IsNotEmpty()
  type: string; // Emoji or reaction type
}

export class UpdateReactionDto {
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class ReactionResponseDto {
  id: string;
  messageId: string;
  userId: string;
  type: string;
  isCustom: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ReactionCountDto {
  type: string;
  count: number;
  userReacted?: boolean; // Optional field to indicate if current user has this reaction
}

export class MessageReactionsAggregateDto {
  messageId: string;
  reactions: ReactionCountDto[];
  totalReactions: number;
  userReactions: string[]; // Array of reaction types the current user has added
}
