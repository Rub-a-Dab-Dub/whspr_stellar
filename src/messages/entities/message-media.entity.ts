import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4';

@Entity('message_media')
@Index(['walletAddress', 'createdAt'])
export class MessageMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_address', length: 56 })
  walletAddress: string;

  @Column({ name: 'ipfs_cid', length: 128 })
  ipfsCid: string;

  @Column({ name: 'content_hash', length: 64 })
  contentHash: string;

  @Column({ name: 'media_type', length: 32 })
  mediaType: MediaType;

  @Column({ name: 'gateway_url', type: 'text' })
  gatewayUrl: string;

  @Column({ name: 'room_id', type: 'bigint', nullable: true })
  roomId: string | null;

  @Column({ name: 'message_id', type: 'bigint', nullable: true })
  messageId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
