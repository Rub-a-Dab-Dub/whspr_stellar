import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportContactEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;
}
