import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum StellarEventStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    CONFIRMED = 'confirmed',
    FAILED = 'failed',
}

@Entity('stellar_blockchain_events')
@Index(['eventName', 'status', 'ledger'])
@Index(['transactionHash', 'eventIndex'], { unique: true })
@Index(['contractId', 'eventName'])
export class StellarBlockchainEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 64 })
    transactionHash: string;

    @Column({ type: 'integer' })
    eventIndex: number;

    @Column({ type: 'integer' })
    ledger: number;

    @Column({ type: 'varchar', length: 56 }) // Stellar contract IDs are 56 chars
    contractId: string;

    @Column({ type: 'varchar', length: 100 })
    eventName: string;

    @Column({ type: 'jsonb', nullable: true })
    topics: any[];

    @Column({ type: 'jsonb' })
    eventData: any;

    @Column({ type: 'jsonb' })
    rawEvent: any;

    @Column({
        type: 'enum',
        enum: StellarEventStatus,
        default: StellarEventStatus.PENDING,
    })
    status: StellarEventStatus;

    @Column({ type: 'boolean', default: false })
    synced: boolean;

    @Column({ type: 'timestamp', nullable: true })
    syncedAt: Date;

    @Column({ type: 'text', nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

@Entity('stellar_sync_state')
export class StellarSyncState {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 56, unique: true })
    contractId: string;

    @Column({ type: 'integer' })
    lastSyncedLedger: number;

    @Column({ type: 'timestamp' })
    lastSyncedAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
