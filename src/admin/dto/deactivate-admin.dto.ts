import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeactivateAdminDto {
  @ApiProperty({
    example: 'Account suspended pending security review',
    minLength: 3,
  })
  @IsString()
  @MinLength(3, { message: 'reason must be at least 3 characters' })
  reason: string;
}
