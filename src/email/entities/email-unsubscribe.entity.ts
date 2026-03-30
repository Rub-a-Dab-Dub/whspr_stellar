import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('email_unsubscribes')
export class EmailUnsubscribe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  @Index('idx_email_unsubscribes_email')
  email!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;
}
