import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteUserDto {
  @ApiProperty({ description: 'Reason for deletion (audit trail)' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({
    example: 'admin@example.com',
    description: 'Admin email for confirmation',
  })
  @IsEmail()
  @IsNotEmpty()
  confirmEmail: string;
}
