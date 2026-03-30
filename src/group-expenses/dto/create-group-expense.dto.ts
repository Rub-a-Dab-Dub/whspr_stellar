import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { GroupExpenseSplitType } from '../entities/group-expense.entity';

export class SplitInputDto {
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

export class CreateGroupExpenseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiProperty({ minimum: 0.0000001 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(0.0000001)
  totalAmount!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  tokenId!: string;

  @ApiProperty({ enum: GroupExpenseSplitType })
  @IsEnum(GroupExpenseSplitType)
  splitType!: GroupExpenseSplitType;

  @ApiPropertyOptional({ type: [SplitInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitInputDto)
  splits?: SplitInputDto[];
}
