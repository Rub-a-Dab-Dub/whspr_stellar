import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class RegisterDto {
  @IsEmail({}, { message: validationMessages.email() })
  email: string | undefined;

  @IsString({ message: validationMessages.string() })
  @MinLength(8, { message: validationMessages.minLength(8) })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'validation.passwordStrength',
  })
  password: string | undefined;

  @IsOptional()
  @IsString({ message: validationMessages.string() })
  preferredLocale?: string;
}
