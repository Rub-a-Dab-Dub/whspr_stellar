import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class RefreshRequestDto {
  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: validationMessages.string() })
  @IsNotEmpty({ message: validationMessages.notEmpty() })
  refreshToken!: string;
}
