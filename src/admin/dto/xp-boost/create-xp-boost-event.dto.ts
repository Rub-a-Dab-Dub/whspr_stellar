import {
  IsString,
  IsNumber,
  IsArray,
  IsDateString,
  Min,
  Max,
  ArrayMinSize,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { XpAction } from '../../../users/constants/xp-actions.constants';

const VALID_ACTIONS = ['all', ...Object.values(XpAction)];

export class CreateXpBoostEventDto {
  @ApiProperty({ example: 'Double XP Weekend' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 2.0,
    minimum: 1.0,
    maximum: 10.0,
    description: 'XP multiplier to apply (1.0–10.0)',
  })
  @IsNumber()
  @Min(1.0)
  @Max(10.0)
  multiplier: number;

  @ApiProperty({
    example: ['all'],
    description: "List of XpAction values to boost, or ['all'] for all actions",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_ACTIONS, { each: true })
  appliesToActions: string[];

  @ApiProperty({ example: '2024-06-01T00:00:00Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: '2024-06-03T00:00:00Z' })
  @IsDateString()
  endAt: string;
}
