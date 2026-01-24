import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { MessageEditHistory } from './message-edit-history.entity';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
@Index(['authorId', 'createdAt'])
@Index(['isDeleted', 'conversationId'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  author: User;

  @Column()
  authorId: string;

  @Column('text')
  content: string;

  @Column('text', { nullable: true })
  originalContent: string | null;

  @Column({ default: false })
  isEdited: boolean;

  @Column({ nullable: true })
  editedAt: Date | null;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedAt: Date | null;

  @Column({ nullable: true })
  deletedBy: string | null;

  @Column({ default: false })
  isHardDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => MessageEditHistory, (history) => history.message, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  editHistory: MessageEditHistory[];
}
