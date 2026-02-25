import { IsString, IsOptional, IsNumber, IsDateString, IsBoolean, Length, Min, Max } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @Length(3, 50)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  entryFee?: string;

  @IsOptional()
  @IsString()
  tokenAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}