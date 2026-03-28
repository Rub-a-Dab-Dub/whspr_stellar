import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class GifSearchQueryDto {
  @IsString()
  q!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @IsString()
  @IsOptional()
  contentFilter?: string;
}
