import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { ImportContactEntryDto } from './import-contact-entry.dto';

export class ImportContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportContactEntryDto)
  contacts!: ImportContactEntryDto[];
}
