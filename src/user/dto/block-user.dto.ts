import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class BlockedUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string | null;

  @ApiProperty()
  avatarUrl: string | null;

  @ApiProperty()
  blockedAt: Date;
}

export class GetBlockedUsersDto {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class BlockedUsersResponseDto {
  @ApiProperty({ type: [BlockedUserDto] })
  users: BlockedUserDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}