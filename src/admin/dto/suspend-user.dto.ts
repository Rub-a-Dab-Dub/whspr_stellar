import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuspendUserDto {
  @ApiProperty({
    example: '2025-03-01T00:00:00Z',
    description: 'ISO 8601 date when suspension ends',
  })
  @IsDateString()
  suspendedUntil: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
