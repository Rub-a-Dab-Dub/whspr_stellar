import { IsString, IsEmail, IsOptional, Length, IsEnum } from 'class-validator';
import { UserVisibility } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  @Length(3, 50)
  username: string;

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
}
