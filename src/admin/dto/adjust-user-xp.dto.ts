import { IsNumber, IsString, IsNotEmpty, Max, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustUserXpDto {
  @ApiProperty({
    description: 'XP delta (can be negative for reductions)',
    example: 100,
  })
  @IsNumber()
  @Min(-999999)
  @Max(999999)
  delta: number;

  @ApiProperty({
    maxLength: 500,
    description: 'Reason for XP adjustment (exploit mitigation, compensation, contest rewards, etc.)',
    example: 'Contest winner - 1st place',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
