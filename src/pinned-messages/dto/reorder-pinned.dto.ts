import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReorderPinnedDto {
  @ApiProperty({
    description:
      'Subset of pinned message ids in desired order; listed pins move to the front in this order.',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  messageIds!: string[];
}
