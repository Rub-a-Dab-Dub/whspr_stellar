import { IsString, IsEmail, IsOptional, Length, IsEnum } from 'class-validator';
import { UserVisibility, UserStatus } from '../entities/user.entity';

export class UpdateUserDto {
  @IsString()
  @Length(3, 50)
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @Length(1, 100)
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(UserVisibility)
  @IsOptional()
  visibility?: UserVisibility;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
