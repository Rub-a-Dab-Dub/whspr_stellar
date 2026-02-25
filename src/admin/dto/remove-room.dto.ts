import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RemoveRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
