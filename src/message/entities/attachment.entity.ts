import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({
    type: 'enum',
    enum: ['IPFS', 'ARWEAVE'],
    default: 'IPFS',
  })
  storageProvider: 'IPFS' | 'ARWEAVE';

  @Column()
  storageHash: string; // CID or Transaction ID

  @Column()
  url: string; // Gateway URL

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column({ default: false })
  isScanned: boolean;

  @ManyToOne(() => Message, (message) => message.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column()
  messageId: string;

  @CreateDateColumn()
  createdAt: Date;
}
