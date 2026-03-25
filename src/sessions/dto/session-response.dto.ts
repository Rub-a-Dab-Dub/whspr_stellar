import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ example: 'f2afabdd-b4cc-4707-b6ca-a6b07f1f1ea7' })
  id!: string;

  @ApiProperty({ example: 'Chrome on macOS' })
  deviceInfo!: string;

  @ApiProperty({ example: '203.0.113.10', nullable: true })
  ipAddress!: string | null;

  @ApiProperty({
    example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0',
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty()
  lastActiveAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty({ example: true })
  isCurrent!: boolean;
}
