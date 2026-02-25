import { IsBoolean } from 'class-validator';

export class SetUserActiveDto {
  @IsBoolean()
  isActive: boolean;
}
