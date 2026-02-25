import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserActiveDto {
  @ApiProperty({ example: true, description: 'Whether the user account is active' })
  @IsBoolean()
  isActive: boolean;
}
