import { IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  walletAddress?: string;
}
