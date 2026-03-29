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

export enum SponsorshipSource {
  PLATFORM = 'PLATFORM',
  PARTNER = 'PARTNER',
}

@Entity('fee_sponsorships')
@Index('idx_fee_sponsorships_user_created', ['userId', 'createdAt'])
@Index('idx_fee_sponsorships_tx_hash', ['txHash'])
export class FeeSponsorship {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_fee_sponsorships_user_id')
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 128 })
  txHash!: string;

  /** Estimated or actual fee in XLM (string for precision). */
  @Column({ type: 'varchar', length: 32 })
  feeAmount!: string;

  @Column({ type: 'enum', enum: SponsorshipSource, default: SponsorshipSource.PLATFORM })
  sponsoredBy!: SponsorshipSource;

  /** Asset code, contract id, or "native" / "XLM". */
  @Column({ type: 'varchar', length: 128, nullable: true })
  tokenId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
