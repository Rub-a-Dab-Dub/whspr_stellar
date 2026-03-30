import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateBotCommandDto {
  @ApiProperty({ example: '/help' })
  @IsString()
  @Matches(/^\/[a-zA-Z0-9_-]+$/u)
  @MaxLength(64)
  command!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  description!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  usage!: string;
}
