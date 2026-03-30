import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_geo_records')
@Index('idx_user_geo_user_id', ['userId'])
@Index('idx_user_geo_detected_at', ['detectedAt'])
export class UserGeoRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  /** ISO 3166-1 alpha-2 country code resolved from IP. */
  @Column({ length: 2 })
  detectedCountry!: string;

  @Column({ length: 45 })
  ipAddress!: string;

  @CreateDateColumn()
  detectedAt!: Date;

  /** Whether the IP was flagged as a VPN/proxy/Tor exit node. */
  @Column({ default: false })
  isVPN!: boolean;
}
