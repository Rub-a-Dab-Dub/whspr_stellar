import { IsIP, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockIpDto {
  @ApiProperty({ example: '203.0.113.42' })
  @IsIP()
  ipAddress: string;

  @ApiPropertyOptional({ example: 'Repeated brute-force attempts' })
  @IsOptional()
  @IsString()
  reason?: string;
}