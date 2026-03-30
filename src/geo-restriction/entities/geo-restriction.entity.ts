import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum RestrictionType {
  FULL_BLOCK = 'FULL_BLOCK',
  FEATURE_LIMIT = 'FEATURE_LIMIT',
  KYC_REQUIRED = 'KYC_REQUIRED',
}

@Entity('geo_restrictions')
@Index('idx_geo_restriction_country', ['countryCode'])
@Index('idx_geo_restriction_active', ['isActive'])
export class GeoRestriction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** ISO 3166-1 alpha-2 country code (e.g. "US", "IR"). */
  @Column({ length: 2 })
  countryCode!: string;

  @Column({
    type: 'enum',
    enum: RestrictionType,
  })
  restrictionType!: RestrictionType;

  /**
   * Specific feature slugs restricted for FEATURE_LIMIT type.
   * Empty for FULL_BLOCK / KYC_REQUIRED at the global level.
   */
  @Column({ type: 'simple-array', nullable: true })
  affectedFeatures?: string[];

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
