import { IsString } from 'class-validator';

export class ImpersonateUserDto {
  @IsString()
  userId: string;
}
