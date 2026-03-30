import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { User } from '../../users/entities/user.entity';
import { ExpenseSplit } from './expense-split.entity';

export enum GroupExpenseSplitType {
  EQUAL = 'EQUAL',
  CUSTOM = 'CUSTOM',
  PERCENTAGE = 'PERCENTAGE',
}

export enum GroupExpenseStatus {
  OPEN = 'OPEN',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED',
  SETTLED = 'SETTLED',
}

@Entity('group_expenses')
export class GroupExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  @Index('idx_group_expenses_group_id')
  groupId!: string;

  @Column({ type: 'uuid' })
  @Index('idx_group_expenses_conversation_id')
  conversationId!: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  @Index('idx_group_expenses_created_by')
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator!: User;

  @Column({ type: 'varchar', length: 180 })
  title!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 64 })
  tokenId!: string;

  @Column({
    type: 'enum',
    enum: GroupExpenseSplitType,
  })
  splitType!: GroupExpenseSplitType;

  @Column({
    type: 'enum',
    enum: GroupExpenseStatus,
    default: GroupExpenseStatus.OPEN,
  })
  @Index('idx_group_expenses_status')
  status!: GroupExpenseStatus;

  @OneToMany(() => ExpenseSplit, (split) => split.expense, { cascade: true })
  splits!: ExpenseSplit[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
