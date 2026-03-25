import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_webhooks_user_id')
  userId!: string;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'varchar', length: 255 })
  secret!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  events!: string[];

  @Column({ type: 'boolean', default: true })
  @Index('idx_webhooks_is_active')
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastDeliveredAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  failureCount!: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
