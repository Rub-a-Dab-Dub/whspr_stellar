import { IsString, IsOptional, IsArray, IsUUID, IsNotEmpty } from 'class-validator';

export class SaveDraftDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsUUID()
  replyToId?: string | null;
}
