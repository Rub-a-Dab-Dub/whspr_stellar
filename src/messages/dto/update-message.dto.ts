import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
