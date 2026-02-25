import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUserDto {
  @ApiProperty({ example: 'john', description: 'Search query for username or wallet address' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  q: string;
}

export class UserSearchResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  avatarUrl: string | null;

  @ApiProperty()
  level: number;

  @ApiProperty()
  isOnline: boolean;
}
