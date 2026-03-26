import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TokenNetwork {
  STELLAR_MAINNET = 'stellar_mainnet',
  STELLAR_TESTNET = 'stellar_testnet',
}

@Entity('tokens')
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 56 })
  @Index('idx_tokens_address', { unique: true })
  address!: string;

  @Column({ type: 'varchar', length: 20 })
  symbol!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'int', default: 7 })
  decimals!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logoUrl!: string | null;

  @Column({
    type: 'enum',
    enum: TokenNetwork,
    default: TokenNetwork.STELLAR_MAINNET,
  })
  network!: TokenNetwork;

  @Column({ type: 'boolean', default: false })
  isNative!: boolean;

  @Column({ type: 'boolean', default: false })
  @Index('idx_tokens_is_whitelisted')
  isWhitelisted!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  coingeckoId!: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  currentPrice!: number | null;

  @Column({ type: 'timestamp', nullable: true })
  priceUpdatedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
