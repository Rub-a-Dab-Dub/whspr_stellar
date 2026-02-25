import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RoomType {
  PUBLIC = 'PUBLIC',
  TOKEN_GATED = 'TOKEN_GATED',
}

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.PUBLIC,
  })
  type: RoomType;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: unknown;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @Column({ name: 'creator_wallet_address', length: 56, nullable: true })
  creatorWalletAddress: string;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  entryFee: string;

  @Column({ name: 'token_address', length: 56, nullable: true })
  tokenAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}