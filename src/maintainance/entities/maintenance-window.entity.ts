// src/maintenance/entities/maintenance-window.entity.ts
import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

export enum MaintenanceStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AffectedService {
  ALL = 'all',
  CHAT = 'chat',
  PAYMENTS = 'payments',
  AUTH = 'auth',
}

@Entity('maintenance_windows')
export class MaintenanceWindow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'timestamp' })
  startAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endAt: Date | null;

  @Column({ type: 'enum', enum: MaintenanceStatus })
  status: MaintenanceStatus;

  @Column({
    type: 'enum',
    enum: AffectedService,
    array: true,
    default: [AffectedService.ALL],
  })
  affectedServices: AffectedService[];

  @ManyToOne(() => User)
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
