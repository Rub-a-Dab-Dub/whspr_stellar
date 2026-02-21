import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiProperty({ description: 'New config value (string, number, boolean, or object)' })
  @IsNotEmpty()
  value: any;

  @ApiProperty({ description: 'Reason for the config change (audit trail)' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
