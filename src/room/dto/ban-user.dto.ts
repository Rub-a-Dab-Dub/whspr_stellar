import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class BanUserDto {
  @IsUUID()
  userId: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
