import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { GroupExpenseSplitType } from '../entities/group-expense.entity';

export class UpdateSplitInputDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ description: 'Used when splitType is CUSTOM' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({ description: 'Used when splitType is PERCENTAGE' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  percentage?: number;
}

export class UpdateExpenseSplitsDto {
  @ApiProperty({ enum: GroupExpenseSplitType })
  @IsEnum(GroupExpenseSplitType)
  splitType!: GroupExpenseSplitType;

  @ApiProperty({ type: [UpdateSplitInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateSplitInputDto)
  splits!: UpdateSplitInputDto[];
}
