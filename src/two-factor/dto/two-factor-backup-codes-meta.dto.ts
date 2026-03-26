import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorBackupCodesMetaDto {
  @ApiProperty({ description: 'Number of unused backup codes remaining' })
  remaining!: number;
}
