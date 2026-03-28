import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorRegenerateResponseDto {
  @ApiProperty({ type: [String] })
  backupCodes!: string[];
}
