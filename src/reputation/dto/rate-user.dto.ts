import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateUserDto {
  @ApiProperty({ description: 'Conversation ID the rating is tied to', format: 'uuid' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ description: 'Rating score between 1 and 5', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @ApiPropertyOptional({ description: 'Optional comment (max 280 chars)', maxLength: 280 })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  comment?: string;
}
