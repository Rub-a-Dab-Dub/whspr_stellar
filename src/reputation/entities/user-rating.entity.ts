import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, Unique } from 'typeorm';

@Entity('user_ratings')
@Unique('uq_rating_rater_conversation', ['raterId', 'conversationId'])
export class UserRating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_ratings_rater_id')
  raterId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_ratings_rated_user_id')
  ratedUserId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_user_ratings_conversation_id')
  conversationId!: string;

  @Column({ type: 'smallint' })
  score!: number; // 1-5

  @Column({ type: 'varchar', length: 280, nullable: true })
  comment!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
