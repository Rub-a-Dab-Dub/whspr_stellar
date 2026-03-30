import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SandboxTestWallet = {
  id: string;
  publicKey: string;
  secretKey: string;
  funded: boolean;
  network: 'stellar_testnet';
  balance: string;
  createdAt: string;
};

@Entity('sandbox_environments')
export class SandboxEnvironment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  @Index('idx_sandbox_environments_user_id')
  userId!: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  @Index('idx_sandbox_environments_api_key_id')
  apiKeyId!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  testWallets!: SandboxTestWallet[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt!: Date;
}
