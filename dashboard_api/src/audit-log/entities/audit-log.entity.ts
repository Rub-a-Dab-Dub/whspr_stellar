import { User } from 'src/user/entities/user.entity';
import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
@Index(['userId'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column({ type: 'json' })
  changes: Record<string, any>;

  @Column()
  performedBy: string;

  @ManyToOne(() => User, (user) => user.auditLogs)
  user: User;

  @Column()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
