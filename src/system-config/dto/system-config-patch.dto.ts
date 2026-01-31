import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { SystemConfigUpdateItemDto } from './system-config-update.dto';
import { SystemConfigRollbackDto } from './system-config-rollback.dto';

export class SystemConfigPatchDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SystemConfigUpdateItemDto)
  updates?: SystemConfigUpdateItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SystemConfigRollbackDto)
  rollback?: SystemConfigRollbackDto;
}
