import { IsEnum, IsString, Length } from 'class-validator';
import { GatedContentType } from '../entities/content-gate.entity';

export class VerifyContentGateDto {
  @IsEnum(GatedContentType)
  contentType!: GatedContentType;

  @IsString()
  @Length(1, 128)
  contentId!: string;
}
