import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class VerifyWalletDto {
  @ApiProperty({ description: 'Base64-encoded signature of the verification message' })
  @IsString({ message: validationMessages.string() })
  @IsNotEmpty({ message: validationMessages.notEmpty() })
  signature!: string;
}
