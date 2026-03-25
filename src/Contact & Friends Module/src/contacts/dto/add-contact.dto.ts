import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddContactDto {
  @IsUUID()
  contactId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
