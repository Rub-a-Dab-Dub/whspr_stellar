import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsNotEmpty()
  value: any;

  @IsOptional()
  description?: string;
}
