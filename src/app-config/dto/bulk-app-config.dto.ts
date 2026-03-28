import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

/** Full replace: must include every key from APP_CONFIG_DEFAULTS */
export class BulkAppConfigDto {
  @ApiProperty({
    description: 'Map of config key to value (complete set of registered keys)',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  values!: Record<string, unknown>;
}
