import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkCredentialDto {
  @ApiProperty()
  @IsUUID()
  credentialId!: string;

  @ApiProperty({ description: 'Target DID record to attach this credential to' })
  @IsUUID()
  didId!: string;
}
