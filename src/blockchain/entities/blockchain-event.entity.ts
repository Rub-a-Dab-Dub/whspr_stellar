import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('blockchain_events')
export class BlockchainEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  contractId!: string;

  @Column('bigint')
  @Index()
  ledger!: number;

  @Column()
  ledgerClosedAt!: Date;

  @Column()
  @Index()
  transactionHash!: string;

  @Column()
  @Index()
  topic!: string;

  @Column('jsonb')
  value!: any;

  @CreateDateColumn()
  createdAt!: Date;
}
