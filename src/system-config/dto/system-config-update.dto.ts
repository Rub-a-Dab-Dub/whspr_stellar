import { IsBoolean, IsDefined, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class SystemConfigUpdateItemDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsDefined()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isFeatureFlag?: boolean;
}
