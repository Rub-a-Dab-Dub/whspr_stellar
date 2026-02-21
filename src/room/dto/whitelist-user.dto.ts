import { IsUUID, IsString, IsOptional } from 'class-validator';

export class WhitelistUserDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
