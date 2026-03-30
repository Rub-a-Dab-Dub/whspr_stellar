import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ExecuteCommandDto {
  @ApiProperty({ example: '/pay @user 10 XLM' })
  @IsString()
  @MaxLength(1000)
  content!: string;
}

