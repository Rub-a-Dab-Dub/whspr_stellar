import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @IsDateString()
  suspendedUntil: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
