import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAppVersionDto } from './create-app-version.dto';

export class UpdateAppVersionDto extends PartialType(CreateAppVersionDto) {
  @IsOptional()
  @IsBoolean()
  isDeprecated?: boolean;
}
