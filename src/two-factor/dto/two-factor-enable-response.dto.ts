import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorEnableResponseDto {
  @ApiProperty({ type: [String], description: 'Single-use backup codes (shown once)' })
  backupCodes!: string[];
}
