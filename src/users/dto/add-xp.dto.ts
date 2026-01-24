import { IsEnum, IsOptional, IsString } from 'class-validator';
import { XpAction } from '../constants/xp-actions.constants';

export class AddXpDto {
  @IsEnum(XpAction)
  action!: XpAction;

  @IsOptional()
  @IsString()
  description?: string;
}
