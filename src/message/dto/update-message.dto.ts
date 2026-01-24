import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
