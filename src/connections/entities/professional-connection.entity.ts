import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Mutual professional connection between two users.
 * userOneId and userTwoId are stored in canonical order (userOneId < userTwoId).
 */
@Entity('professional_connections')
@Index('idx_prof_connections_user_one', ['userOneId'])
@Index('idx_prof_connections_user_two', ['userTwoId'])
export class ProfessionalConnection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userOneId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userOneId' })
  userOne!: User;

  @Column({ type: 'uuid' })
  userTwoId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userTwoId' })
  userTwo!: User;

  @CreateDateColumn({ type: 'timestamp' })
  connectedAt!: Date;

  /** Cached mutual professional connection count between the two users (third parties linked to both). */
  @Column({ type: 'int', default: 0 })
  mutualCount!: number;
}
