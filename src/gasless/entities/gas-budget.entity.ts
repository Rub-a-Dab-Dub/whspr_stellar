import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('gas_budgets')
export class GasBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ default: 100000 })
  dailyLimit: number; // stroops

  @Column({ default: 0 })
  used: number;
}
