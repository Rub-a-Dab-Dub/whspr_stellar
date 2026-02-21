import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('ip_whitelist')
export class IpWhitelist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'cidr' })
  ipCidr: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  addedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'addedBy' })
  addedByUser: User;

  @CreateDateColumn()
  createdAt: Date;
}
