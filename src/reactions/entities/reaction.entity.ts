import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('reactions')
@Unique('uq_reactions_message_user_emoji', ['messageId', 'userId', 'emoji'])
@Index('idx_reactions_message_id', ['messageId'])
@Index('idx_reactions_message_emoji', ['messageId', 'emoji'])
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  messageId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  emoji!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
