import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEmail,
} from 'class-validator';

export class DeleteUserDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsEmail()
  @IsNotEmpty()
  confirmEmail: string;
}
