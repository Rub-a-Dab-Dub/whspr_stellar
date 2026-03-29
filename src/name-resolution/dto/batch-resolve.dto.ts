import { ArrayMaxSize, IsArray, IsString, Length } from 'class-validator';

export const MAX_BATCH_NAMES = 50;

export class BatchResolveDto {
  @IsArray()
  @ArrayMaxSize(MAX_BATCH_NAMES)
  @IsString({ each: true })
  @Length(1, 512, { each: true })
  names!: string[];
}
