import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { ContractStateKeyType } from '../contract-state-key-type.enum';

@Entity('contract_state_cache')
@Unique('uq_contract_state_cache_contract_key', ['contractAddress', 'stateKey'])
@Index('idx_contract_state_cache_contract', ['contractAddress'])
@Index('idx_contract_state_cache_key_type', ['contractAddress', 'keyType'])
export class ContractStateCacheEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, name: 'contract_address' })
  contractAddress!: string;

  /** Stable key, e.g. USER_REGISTRY:<userId>, TOKEN_BAL:<token>:<addr> */
  @Column({ type: 'varchar', length: 512, name: 'state_key' })
  stateKey!: string;

  @Column({
    type: 'enum',
    enum: ContractStateKeyType,
    enumName: 'contract_state_key_type_enum',
    name: 'key_type',
  })
  keyType!: ContractStateKeyType;

  @Column({ type: 'jsonb', name: 'state_value' })
  stateValue!: Record<string, unknown> | unknown[] | string | number | boolean | null;

  /** Ledger sequence observed when this value was written (Soroban). */
  @Column({ type: 'bigint', name: 'ledger' })
  ledger!: string;

  @Column({ type: 'timestamptz', name: 'cached_at' })
  cachedAt!: Date;

  /** TTL in seconds for Redis L1; row remains until invalidated or overwritten. */
  @Column({ type: 'int', name: 'ttl_seconds', default: 300 })
  ttlSeconds!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
