import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('blockchain_cursors')
export class BlockchainCursor {
  @PrimaryColumn()
  id!: string; // e.g., 'soroban-events'

  @Column('bigint', { default: 0 })
  lastLedger!: number;

  @Column({ nullable: true })
  lastCursor?: string; // Paging token or similar

  @UpdateDateColumn()
  updatedAt!: Date;
}
