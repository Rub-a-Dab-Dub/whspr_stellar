import { IsNotEmpty, IsUUID } from 'class-validator';

export class AdminResetPasswordDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
