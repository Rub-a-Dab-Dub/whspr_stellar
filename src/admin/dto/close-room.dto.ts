import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CloseRoomDto {
  @ApiProperty({
    maxLength: 500,
    description: 'Reason for closing the room',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
