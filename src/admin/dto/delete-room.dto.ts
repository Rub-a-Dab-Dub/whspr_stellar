import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteRoomDto {
  @ApiProperty({
    maxLength: 500,
    description: 'Reason for deleting the room',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({
    description: 'Force refund even if room is not within 24 hours (SUPER_ADMIN only)',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  forceRefund?: boolean;
}
