import { IsString, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkUploadDto {
  @ApiProperty({ description: 'Payment batch label', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  @IsNotEmpty()
  label: string;

  // csv: handled by FileInterceptor('csv')
  // pin: handled by TwoFactorGuard/session
}

