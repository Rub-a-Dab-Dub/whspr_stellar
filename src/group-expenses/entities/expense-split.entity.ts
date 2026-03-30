import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { GroupExpense } from './group-expense.entity';

@Entity('expense_splits')
@Index('idx_expense_splits_expense_id', ['expenseId'])
@Index('idx_expense_splits_user_id', ['userId'])
export class ExpenseSplit {
  @PrimaryColumn({ type: 'uuid' })
  expenseId!: string;

  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => GroupExpense, (expense) => expense.splits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expenseId' })
  expense!: GroupExpense;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'numeric', precision: 20, scale: 7 })
  amountOwed!: string;

  @Column({ type: 'numeric', precision: 20, scale: 7, default: '0' })
  amountPaid!: string;

  @Column({ type: 'boolean', default: false })
  isPaid!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;
}
