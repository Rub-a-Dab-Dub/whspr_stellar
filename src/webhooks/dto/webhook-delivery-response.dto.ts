import { ApiProperty } from '@nestjs/swagger';
import { WebhookDeliveryStatus } from '../entities/webhook-delivery.entity';

export class WebhookDeliveryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  webhookId!: string;

  @ApiProperty()
  eventType!: string;

  @ApiProperty({ type: 'object' })
  payload!: Record<string, unknown>;

  @ApiProperty({ enum: WebhookDeliveryStatus })
  status!: WebhookDeliveryStatus;

  @ApiProperty({ nullable: true })
  responseCode!: number | null;

  @ApiProperty()
  deliveredAt!: Date;
}
