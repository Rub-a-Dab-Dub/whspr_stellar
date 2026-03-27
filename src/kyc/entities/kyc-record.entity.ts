import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export enum KYCStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED',
  }
  
  export enum KYCTier {
    BASIC = 'BASIC',
    GOLD = 'GOLD',
    BLACK = 'BLACK',
  }
  
  @Entity('kyc_records')
  export class KYCRecord {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @Column({ name: 'user_id' })
    userId!: string;
  
    @Column()
    provider!: string;
  
    @Column({ name: 'external_id', nullable: true })
    externalId!: string;
  
    @Column({
      type: 'enum',
      enum: KYCStatus,
      default: KYCStatus.PENDING,
    })
    status!: KYCStatus;
  
    @Column({
      type: 'enum',
      enum: KYCTier,
      default: KYCTier.BASIC,
    })
    tier!: KYCTier;
  
    @Column({ name: 'verified_at', nullable: true })
    verifiedAt!: Date | null;
  
    @Column({ type: 'jsonb', nullable: true })
    documents!: Record<string, any>;
  
    @Column({ name: 'rejection_reason', nullable: true })
    rejectionReason!: string | null;
  
    @Column({ name: 'session_token', nullable: true })
    sessionToken!: string | null;
  
    @Column({ name: 'resubmission_allowed_at', nullable: true })
    resubmissionAllowedAt!: Date | null;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
  }