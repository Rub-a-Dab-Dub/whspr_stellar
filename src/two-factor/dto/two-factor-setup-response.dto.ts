import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorSetupResponseDto {
  @ApiProperty({ description: 'otpauth:// URI for authenticator QR setup' })
  otpauthUrl!: string;

  @ApiProperty({ description: 'Base32 secret for manual entry' })
  manualEntryKey!: string;
}
