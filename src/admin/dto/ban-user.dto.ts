import { IsString, IsOptional, MaxLength } from 'class-validator';

export class BanUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
