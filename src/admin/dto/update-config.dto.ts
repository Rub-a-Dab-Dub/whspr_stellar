import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsNotEmpty()
  value: any;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
