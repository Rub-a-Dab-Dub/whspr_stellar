import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'ABC12345' })
  @IsOptional()
  @IsString()
  @Length(8, 12)
  referralCode?: string;
}