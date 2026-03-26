import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class AddReactionDto {
  @ApiProperty({ description: 'Emoji to react with', example: '🔥' })
  @IsString()
  @MaxLength(32)
  emoji!: string;
}
