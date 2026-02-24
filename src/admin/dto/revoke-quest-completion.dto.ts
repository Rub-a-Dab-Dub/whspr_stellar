import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RevokeQuestCompletionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
