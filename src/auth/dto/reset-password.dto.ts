import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string | undefined;

  @IsString()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain uppercase, lowercase, and number/special character',
  })
  newPassword: string | undefined;
}
