import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnbanUserDto {
  @ApiProperty({ maxLength: 500, description: 'Reason for unbanning the user' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
