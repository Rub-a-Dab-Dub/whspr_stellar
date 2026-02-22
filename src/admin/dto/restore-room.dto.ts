import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreRoomDto {
  @ApiProperty({
    maxLength: 500,
    description: 'Reason for restoring the room',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
