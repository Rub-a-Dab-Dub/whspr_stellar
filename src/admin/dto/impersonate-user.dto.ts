import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImpersonateUserDto {
  @ApiProperty({ description: 'User ID to impersonate' })
  @IsString()
  userId: string;
}
