import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TxStatus } from '../enums/tx-status.enum';

@Entity('gasless_transactions')
export class GaslessTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  to: string;

  @Column('text')
  xdr: string; // signed Stellar transaction XDR

  @Column()
  nonce: number;

  @Column({ type: 'enum', enum: TxStatus, default: TxStatus.PENDING })
  status: TxStatus;

  @Column({ nullable: true })
  txHash?: string;

  @Column({ default: 0 })
  retries: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
