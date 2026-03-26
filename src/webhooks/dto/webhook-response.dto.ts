import { ApiProperty } from '@nestjs/swagger';

export class WebhookResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ description: 'Masked webhook secret' })
  secret!: string;

  @ApiProperty({ type: [String] })
  events!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  lastDeliveredAt!: Date | null;

  @ApiProperty()
  failureCount!: number;

  @ApiProperty()
  createdAt!: Date;
}
