import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Tracks the last successfully indexed ledger per contract.
 * Used to resume polling after restarts without re-processing old events.
 */
@Entity('indexer_cursors')
export class IndexerCursor {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  contractId!: string;

  @Column({ type: 'bigint' })
  lastLedger!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
