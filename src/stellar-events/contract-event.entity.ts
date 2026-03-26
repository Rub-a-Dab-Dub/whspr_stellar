import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('contract_events')
@Index('idx_contract_events_contract_topic', ['contractId', 'topic0'])
@Index('idx_contract_events_ledger', ['ledgerSequence'])
export class ContractEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Soroban event id "<ledger>-<txIndex>-<eventIndex>" — globally unique */
  @Column({ type: 'varchar', length: 64, unique: true })
  eventId!: string;

  @Column({ type: 'varchar', length: 64 })
  contractId!: string;

  @Column({ type: 'bigint' })
  ledgerSequence!: number;

  @Column({ type: 'int' })
  eventIndex!: number;

  /** topics[0] — event name symbol */
  @Column({ type: 'varchar', length: 64 })
  topic0!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  topic1!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  topic2!: string | null;

  @Column({ type: 'jsonb' })
  payload!: object;

  @Column({ type: 'text' })
  rawValueXdr!: string;

  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  @CreateDateColumn()
  indexedAt!: Date;
}
