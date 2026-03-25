import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_webhook_deliveries_webhook_id')
  webhookId!: string;

  @Column({ type: 'varchar', length: 120 })
  @Index('idx_webhook_deliveries_event_type')
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'integer', nullable: true })
  responseCode!: number | null;

  @CreateDateColumn({ type: 'timestamp' })
  deliveredAt!: Date;
}
