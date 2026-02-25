import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Operations a session key is permitted to authorise.
 * Scopes are intentionally coarse-grained — add new values as features grow.
 */
export enum SessionKeyScope {
  TIP = 'tip',
  TRANSFER = 'transfer',
  MESSAGE = 'message',
}

@Entity('session_keys')
@Index('IDX_SK_USER_ACTIVE', ['userId', 'isRevoked', 'expiresAt'])
export class SessionKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Ownership ──────────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ── Key material ───────────────────────────────────────────────────────────

  /**
   * The public key of the delegated signer (Stellar ed25519 or EVM secp256k1).
   * Stored as a hex string; never the private key.
   */
  @Index()
  @Column({ name: 'public_key', type: 'varchar', length: 128, unique: true })
  publicKey: string;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  // ── Spending limits ────────────────────────────────────────────────────────

  /**
   * Maximum amount (in the token's base unit, e.g. stroops for XLM) allowed
   * per single transaction. NULL = no per-tx limit.
   */
  @Column({
    name: 'spending_limit_per_tx',
    type: 'decimal',
    precision: 30,
    scale: 8,
    nullable: true,
  })
  spendingLimitPerTx: string | null;

  /**
   * Cumulative spend cap over the key's lifetime. NULL = no total limit.
   */
  @Column({
    name: 'total_spending_limit',
    type: 'decimal',
    precision: 30,
    scale: 8,
    nullable: true,
  })
  totalSpendingLimit: string | null;

  /**
   * Running total of amount spent via this key.
   * Incremented atomically on each successful transaction.
   */
  @Column({
    name: 'total_spent_amount',
    type: 'decimal',
    precision: 30,
    scale: 8,
    default: '0',
  })
  totalSpentAmount: string;

  // ── Scope ──────────────────────────────────────────────────────────────────

  /**
   * Array of operations this key is authorised to perform.
   * Stored as a simple text[] column for easy querying.
   */
  @Column({
    name: 'scope',
    type: 'simple-array',
  })
  scope: SessionKeyScope[];

  // ── Optional metadata ──────────────────────────────────────────────────────

  /** Human-readable name set by the user (e.g. "Mobile dApp", "Trading bot") */
  @Column({ name: 'label', type: 'varchar', length: 100, nullable: true })
  label: string | null;

  // ── Timestamps ─────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
