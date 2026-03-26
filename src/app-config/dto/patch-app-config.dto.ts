import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class PatchAppConfigDto {
  @Allow()
  @ApiProperty({
    description: 'New value; must match the key declared valueType',
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array' },
    ],
  })
  value!: unknown;
}
