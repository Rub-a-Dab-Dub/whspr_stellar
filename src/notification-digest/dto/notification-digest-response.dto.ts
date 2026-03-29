import { ApiProperty } from '@nestjs/swagger';

export class QuietHoursConfigResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty()
  startTime!: string;

  @ApiProperty()
  endTime!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ type: [String] })
  exemptTypes!: string[];

  @ApiProperty()
  updatedAt!: Date;
}

export class DigestSendResponseDto {
  @ApiProperty()
  digestId!: string;

  @ApiProperty()
  notificationCount!: number;

  @ApiProperty()
  sentAt!: Date;
}
